/**
 * Boost meter state machine — pure, canvas-free logic extracted from the Ship so
 * the drain/regen/cooldown rules can be reasoned about and unit-tested in
 * isolation (see boost.test.ts).
 *
 * Rules (tutorial-scale):
 *  - The meter runs 0..MAX (100).
 *  - While boosting (and allowed to), it drains at DRAIN_RATE (50/s).
 *  - While not boosting, it regenerates at REGEN_RATE (10/s), clamped to MAX.
 *  - When the meter hits 0 it enters a COOLDOWN (2 s) during which boosting is
 *    impossible regardless of input. Regen still runs during cooldown; boosting
 *    only becomes possible again once the cooldown has fully elapsed.
 *
 * The state carries no notion of *which* boost (up/down) is requested — that is
 * the Ship's concern. Here "boosting" simply means "the player asked to spend
 * Boost this tick". `canBoost` tells the Ship whether that request is honoured.
 */

export const BOOST_MAX = 100;
export const BOOST_DRAIN_RATE = 50; // per second while boosting
export const BOOST_REGEN_RATE = 10; // per second while not boosting
export const BOOST_COOLDOWN = 2; // seconds locked out after full depletion

export interface BoostState {
  current: number;
  /** Remaining cooldown time in seconds; 0 when not on cooldown. */
  cooldown: number;
  /** This meter's ceiling and starting value. */
  max: number;
  /** Regeneration rate (per second) while not boosting. */
  regenRate: number;
}

/**
 * Fresh, full boost meter, no cooldown. `max` and `regenRate` default to the v1
 * constants so an argument-free call reproduces v1 behavior; the Ship passes the
 * Skill-Tree-resolved `maxBoost` / `boostRegen` values when they differ. Drain
 * rate and cooldown are not modifier-controlled and stay constant.
 */
export function createBoostState(max = BOOST_MAX, regenRate = BOOST_REGEN_RATE): BoostState {
  return { current: max, cooldown: 0, max, regenRate };
}

export function canBoost(state: BoostState): boolean {
  return state.cooldown <= 0 && state.current > 0;
}

/**
 * Advance the meter by `dt` seconds. `requesting` is whether the player is
 * holding a boost/brake key this tick. Returns whether Boost was actually spent
 * (so the Ship can key its speed multiplier and trail color off real spend, not
 * just the key state).
 */
export function updateBoost(state: BoostState, dt: number, requesting: boolean): boolean {
  // Snap tiny float residue to 0 so the lockout can't linger an extra tick
  // after summing dt across many frames.
  if (state.cooldown > 0) {
    state.cooldown -= dt;
    if (state.cooldown < 1e-9) state.cooldown = 0;
  }

  const boosting = requesting && canBoost(state);

  if (boosting) {
    state.current -= BOOST_DRAIN_RATE * dt;
    if (state.current <= 0) {
      state.current = 0;
      state.cooldown = BOOST_COOLDOWN;
    }
  } else {
    state.current += state.regenRate * dt;
    if (state.current > state.max) state.current = state.max;
  }

  return boosting;
}
