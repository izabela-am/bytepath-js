import { describe, it, expect } from 'vitest';
import { loadPrefs, storePrefs, defaultPrefs, PREFS_KEY } from './prefs';
import type { SaveStorage } from '../save/save';

/** In-memory storage fake, mirroring the save module's test fixture. */
function fakeStorage(seed?: Record<string, string>): SaveStorage {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('prefs', () => {
  it('defaults to scanlines on and sound on', () => {
    expect(defaultPrefs()).toEqual({ scanlines: true, sound: true });
  });

  it('yields defaults when nothing is stored', () => {
    expect(loadPrefs(fakeStorage())).toEqual(defaultPrefs());
  });

  it('round-trips stored prefs', () => {
    const storage = fakeStorage();
    storePrefs(storage, { scanlines: false, sound: false });
    expect(loadPrefs(storage)).toEqual({ scanlines: false, sound: false });
  });

  it('uses its own key, not the save key', () => {
    const storage = fakeStorage();
    storePrefs(storage, { scanlines: false, sound: true });
    expect(storage.getItem(PREFS_KEY)).not.toBeNull();
    expect(storage.getItem('bytepath-save')).toBeNull();
  });

  it('falls back to defaults on unparsable payload', () => {
    expect(loadPrefs(fakeStorage({ [PREFS_KEY]: 'not json' }))).toEqual(defaultPrefs());
  });

  it('falls back to defaults on wrong-shape payload', () => {
    expect(loadPrefs(fakeStorage({ [PREFS_KEY]: JSON.stringify({ scanlines: 'yes' }) }))).toEqual(
      defaultPrefs(),
    );
  });

  it('returns a fresh copy that callers may mutate', () => {
    const storage = fakeStorage();
    const a = loadPrefs(storage);
    a.scanlines = false;
    const b = loadPrefs(storage);
    expect(b.scanlines).toBe(true);
  });
});
