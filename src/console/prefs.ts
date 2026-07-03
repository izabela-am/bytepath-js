/**
 * Console UI preferences — the scanlines overlay and sound toggles, persisted
 * under their OWN localStorage key, deliberately separate from the versioned
 * game save (ADR 0003 owns `bytepath-save`; these cosmetic prefs must never touch
 * that schema). Pure logic over an injected storage backend so it is unit-testable
 * with an in-memory fake, mirroring `src/save/save.ts`.
 *
 * A missing, unparsable, or wrong-shape payload silently yields the defaults
 * (scanlines on, sound on). Sound is stored here so the preference survives a
 * reload, but the live mute state lives on the shared `Sfx` instance — the
 * ConsoleRoom keeps the two in sync.
 */

/** Reuses the save module's minimal Web Storage subset so tests share one fake. */
import type { SaveStorage } from '../save/save';

/** The persisted preference shape. */
export interface Prefs {
  scanlines: boolean;
  sound: boolean;
}

/** The localStorage key for prefs — separate from the game save's key. */
export const PREFS_KEY = 'bytepath-prefs';

/** Defaults: scanlines on (the intended default look), sound on. */
export function defaultPrefs(): Prefs {
  return { scanlines: true, sound: true };
}

/** Structural check that a parsed payload is a valid Prefs object. */
function isValidPrefs(value: unknown): value is Prefs {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.scanlines === 'boolean' && typeof v.sound === 'boolean';
}

/**
 * Load prefs from `storage`. A missing, unparsable, or wrong-shape payload
 * silently yields {@link defaultPrefs}. The returned object is a fresh copy.
 */
export function loadPrefs(storage: SaveStorage): Prefs {
  const raw = storage.getItem(PREFS_KEY);
  if (raw === null) return defaultPrefs();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultPrefs();
  }

  if (!isValidPrefs(parsed)) return defaultPrefs();
  return { scanlines: parsed.scanlines, sound: parsed.sound };
}

/** Serialize and persist `prefs` under {@link PREFS_KEY}. */
export function storePrefs(storage: SaveStorage, prefs: Prefs): void {
  storage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
