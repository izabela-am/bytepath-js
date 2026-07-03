/**
 * Score accounting for a Run (CONTEXT.md: "The numeric result of a Run, driven
 * by survival and destroying enemies"). Pure and canvas-free so the arithmetic
 * is unit-testable without a DOM — the Stage holds one Score, feeds it kills,
 * pickups, and survival time, and the HUD reads `value`.
 *
 * Three sources contribute:
 *  - **Kills**: each destroyed enemy awards its `scoreValue`.
 *  - **Pickups**: collecting a Pickup awards a small fixed bonus by kind.
 *  - **Survival**: SURVIVAL_RATE points accrue per second alive. Fractional
 *    seconds accumulate so the total is smooth and frame-rate independent; the
 *    reported `value` is always an integer (floored).
 */

/** Points awarded per second survived. */
export const SURVIVAL_RATE = 1;

/** Fixed Score bonus awarded when collecting each Pickup kind. */
export const PICKUP_BONUS = {
  Ammo: 50,
  Boost: 50,
  Attack: 150,
} as const;

export type PickupKind = keyof typeof PICKUP_BONUS;

export class Score {
  /** Accumulated points from kills + pickups (always whole numbers). */
  private discrete = 0;
  /** Accumulated survival points, kept fractional then floored on read. */
  private survival = 0;

  /** Current Score, floored to a whole number (kills + pickups + survival). */
  get value(): number {
    return this.discrete + Math.floor(this.survival);
  }

  /** Award an enemy kill worth `scoreValue` points. */
  addKill(scoreValue: number): void {
    this.discrete += scoreValue;
  }

  /** Award the fixed bonus for collecting a Pickup of the given kind. */
  addPickup(kind: PickupKind): void {
    this.discrete += PICKUP_BONUS[kind];
  }

  /** Accrue survival points for `dt` seconds of staying alive. */
  addSurvival(dt: number): void {
    this.survival += dt * SURVIVAL_RATE;
  }
}
