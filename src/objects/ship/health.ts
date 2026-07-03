/**
 * Ship health state machine — pure, canvas-free logic extracted from the Ship so
 * the HP / damage / invulnerability rules can be reasoned about and unit-tested
 * in isolation (see health.test.ts).
 *
 * Rules (tutorial-scale):
 *  - HP runs 0..MAX (100). The Ship spawns full.
 *  - Taking damage subtracts from HP (clamped at 0) and opens a brief
 *    invulnerability window (INVULN_DURATION) during which further damage is
 *    ignored. Damage arriving while already invulnerable is a no-op.
 *  - HP reaching 0 means the Ship is dead — the Run ends. Death is reported by
 *    `applyDamage` returning `true` so the caller can trigger the death beat.
 *  - The invulnerability window ticks down via `updateHealth`; `isInvulnerable`
 *    reports whether it is active (drives the blink visual).
 *
 * The state carries no canvas / GameObject concerns — the Ship holds one of
 * these and mirrors `current` / invulnerability into its visuals.
 */

export const SHIP_MAX_HP = 100;

/** Seconds of invulnerability granted after taking a hit. */
export const SHIP_INVULN_DURATION = 0.5;

export interface HealthState {
  /** Current HP, 0..SHIP_MAX_HP. */
  current: number;
  /** Remaining invulnerability time in seconds; 0 when vulnerable. */
  invuln: number;
}

/** Fresh, full-health state with no invulnerability. */
export function createHealthState(): HealthState {
  return { current: SHIP_MAX_HP, invuln: 0 };
}

/** Whether the Ship is currently invulnerable (in its post-hit window). */
export function isInvulnerable(state: HealthState): boolean {
  return state.invuln > 0;
}

/** Whether HP has reached 0. */
export function isDead(state: HealthState): boolean {
  return state.current <= 0;
}

/**
 * Advance the invulnerability window by `dt` seconds. Snap tiny float residue to
 * 0 so the window can't linger an extra tick after summing dt across frames.
 */
export function updateHealth(state: HealthState, dt: number): void {
  if (state.invuln > 0) {
    state.invuln -= dt;
    if (state.invuln < 1e-9) state.invuln = 0;
  }
}

/**
 * Apply `amount` damage. Ignored while invulnerable or already dead. On a landed
 * hit, subtracts HP (clamped at 0) and opens the invulnerability window. Returns
 * `true` iff this hit brought the Ship to 0 HP (i.e. killed it this call), so the
 * caller can fire the death beat exactly once.
 */
export function applyDamage(state: HealthState, amount: number): boolean {
  if (isDead(state)) return false;
  if (isInvulnerable(state)) return false;

  state.current -= amount;
  if (state.current < 0) state.current = 0;
  state.invuln = SHIP_INVULN_DURATION;

  return state.current <= 0;
}
