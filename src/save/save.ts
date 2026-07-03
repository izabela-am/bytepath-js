/**
 * Persistent save — pure logic over an injected storage backend (ADR 0003: "a
 * single versioned localStorage key ({ version, sp, ownedNodes, bestScore });
 * corrupt or unknown payloads silently start a fresh save"). The Console loads
 * the save on boot, banks SP and updates the best Score when a Run ends, and
 * feeds owned Nodes to the Skill Tree.
 *
 * Storage is injected via the minimal {@link SaveStorage} interface (a subset of
 * the Web Storage API) so the rules are unit-testable without a real
 * localStorage — tests pass an in-memory fake. `browserStorage()` binds the
 * default `window.localStorage`, guarded so importing this module in a non-browser
 * environment (Vitest/node) never throws.
 *
 * Corruption policy: `load()` treats a missing, unparsable, wrong-shape, or
 * unknown-version payload identically — it silently returns a fresh default save.
 * There is no migration path yet; a future version bump adds one here.
 */

/** The persisted shape. `version` gates forward-compatibility. */
export interface SaveData {
  version: 1;
  /** Banked SP available to spend in the Skill Tree. */
  sp: number;
  /** Ids of the Nodes the player owns (root is implicit, never listed). */
  ownedNodes: string[];
  /** Best Score across all Runs. */
  bestScore: number;
}

/** The current save schema version. Bump + migrate when the shape changes. */
export const SAVE_VERSION = 1;

/** The single localStorage key the whole save lives under. */
export const SAVE_KEY = 'bytepath-save';

/**
 * The slice of the Web Storage API the save needs. Injected so tests never touch
 * a real localStorage; any object satisfying this works.
 */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A brand-new save: no SP, no owned Nodes, no best Score. */
export function defaultSave(): SaveData {
  return { version: SAVE_VERSION, sp: 0, ownedNodes: [], bestScore: 0 };
}

/**
 * Bind the default `window.localStorage`, or null when it is unavailable (SSR,
 * Vitest/node, privacy modes that throw on access). Callers fall back to a
 * fresh save when this returns null, so persistence silently no-ops off-browser.
 */
export function browserStorage(): SaveStorage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Accessing localStorage can throw (e.g. blocked cookies / sandboxed frame).
    return null;
  }
}

/** Structural check that a parsed payload matches the current SaveData shape. */
function isValidSave(value: unknown): value is SaveData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.version !== SAVE_VERSION) return false;
  if (typeof v.sp !== 'number' || !Number.isFinite(v.sp)) return false;
  if (typeof v.bestScore !== 'number' || !Number.isFinite(v.bestScore)) return false;
  if (!Array.isArray(v.ownedNodes)) return false;
  if (!v.ownedNodes.every((id) => typeof id === 'string')) return false;
  return true;
}

/**
 * Load the save from `storage`. A missing, unparsable, wrong-shape, or
 * unknown-version payload silently yields a fresh {@link defaultSave} (ADR 0003).
 * The returned object is a fresh copy the caller may mutate freely.
 */
export function load(storage: SaveStorage): SaveData {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return defaultSave();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultSave();
  }

  if (!isValidSave(parsed)) return defaultSave();

  // Copy out so external mutation of the returned value never aliases anything,
  // and drop any extra keys the payload may carry.
  return {
    version: SAVE_VERSION,
    sp: parsed.sp,
    ownedNodes: [...parsed.ownedNodes],
    bestScore: parsed.bestScore,
  };
}

/** Serialize and persist `save` under {@link SAVE_KEY}. */
export function store(storage: SaveStorage, save: SaveData): void {
  storage.setItem(SAVE_KEY, JSON.stringify(save));
}

/** Remove the save entirely; a subsequent `load` yields a fresh default. */
export function wipe(storage: SaveStorage): void {
  storage.removeItem(SAVE_KEY);
}
