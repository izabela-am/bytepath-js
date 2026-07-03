import { describe, it, expect } from 'vitest';
import {
  load,
  store,
  wipe,
  defaultSave,
  browserStorage,
  SAVE_KEY,
  SAVE_VERSION,
  type SaveData,
  type SaveStorage,
} from './save';

/** In-memory SaveStorage fake — no real localStorage touched. */
function fakeStorage(seed?: string): SaveStorage & { raw(): string | null } {
  let value: string | null = seed ?? null;
  return {
    getItem: () => value,
    setItem: (_key, v) => {
      value = v;
    },
    removeItem: () => {
      value = null;
    },
    raw: () => value,
  };
}

describe('save', () => {
  it('a fresh default save is empty', () => {
    expect(defaultSave()).toEqual({ version: SAVE_VERSION, sp: 0, ownedNodes: [], bestScore: 0 });
  });

  it('round-trips a stored save', () => {
    const storage = fakeStorage();
    const save: SaveData = { version: 1, sp: 12, ownedNodes: ['rapid', 'damage'], bestScore: 4200 };
    store(storage, save);
    expect(load(storage)).toEqual(save);
  });

  it('load returns a fresh save when nothing is stored', () => {
    expect(load(fakeStorage())).toEqual(defaultSave());
  });

  it('the loaded save is a copy that does not alias stored state', () => {
    const storage = fakeStorage();
    store(storage, { version: 1, sp: 5, ownedNodes: ['a'], bestScore: 0 });
    const loaded = load(storage);
    loaded.ownedNodes.push('b');
    // Re-loading is unaffected by mutating the earlier result.
    expect(load(storage).ownedNodes).toEqual(['a']);
  });

  describe('corruption → fresh save (silently)', () => {
    it('unparsable JSON', () => {
      expect(load(fakeStorage('{not json'))).toEqual(defaultSave());
    });

    it('valid JSON of the wrong type (array)', () => {
      expect(load(fakeStorage('[]'))).toEqual(defaultSave());
    });

    it('valid JSON of the wrong type (null)', () => {
      expect(load(fakeStorage('null'))).toEqual(defaultSave());
    });

    it('missing fields', () => {
      expect(load(fakeStorage(JSON.stringify({ version: 1, sp: 3 })))).toEqual(defaultSave());
    });

    it('wrong field types', () => {
      const bad = JSON.stringify({ version: 1, sp: 'lots', ownedNodes: [], bestScore: 0 });
      expect(load(fakeStorage(bad))).toEqual(defaultSave());
    });

    it('ownedNodes holding non-strings', () => {
      const bad = JSON.stringify({ version: 1, sp: 0, ownedNodes: [1, 2], bestScore: 0 });
      expect(load(fakeStorage(bad))).toEqual(defaultSave());
    });

    it('non-finite numbers', () => {
      const bad = JSON.stringify({ version: 1, sp: 0, ownedNodes: [], bestScore: 'NaN-ish' });
      expect(load(fakeStorage(bad))).toEqual(defaultSave());
    });
  });

  it('unknown version → fresh save', () => {
    const future = JSON.stringify({ version: 2, sp: 99, ownedNodes: ['x'], bestScore: 1 });
    expect(load(fakeStorage(future))).toEqual(defaultSave());
  });

  it('store writes under the single save key', () => {
    const storage = fakeStorage();
    store(storage, defaultSave());
    expect(JSON.parse(storage.raw()!)).toEqual(defaultSave());
  });

  it('wipe clears the save; a subsequent load is fresh', () => {
    const storage = fakeStorage();
    store(storage, { version: 1, sp: 7, ownedNodes: ['a'], bestScore: 10 });
    wipe(storage);
    expect(storage.raw()).toBeNull();
    expect(load(storage)).toEqual(defaultSave());
  });

  it('SAVE_KEY is the documented single key', () => {
    expect(SAVE_KEY).toBe('bytepath-save');
  });

  it('browserStorage is null in a non-browser environment', () => {
    // Vitest runs under node with no window; the guard must not throw.
    expect(browserStorage()).toBeNull();
  });
});
