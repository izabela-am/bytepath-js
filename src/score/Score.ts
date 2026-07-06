/**
 * Survival points accumulate fractionally so the total is smooth and
 * frame-rate independent; the reported `value` is always an integer (floored).
 *
 * The `scoreMultiplier` (the Skill Tree stat, default 1) uniformly scales every
 * accrual source before it lands in the pool. Kills and pickups scale then
 * round to whole points; survival scales as it accumulates and is floored on
 * read. A multiplier of 1 leaves every source untouched, so a fresh save
 * (identity modifiers) reproduces v1 Score exactly.
 */

export const SURVIVAL_RATE = 1;

export const PICKUP_BONUS = {
  Ammo: 50,
  Boost: 50,
  Attack: 150,
  SP: 50,
} as const;

export type PickupKind = keyof typeof PICKUP_BONUS;

export class Score {
  /** Accumulated points from kills + pickups (always whole numbers). */
  private discrete = 0;
  /** Accumulated survival points, kept fractional then floored on read. */
  private survival = 0;
  private readonly multiplier: number;

  constructor(scoreMultiplier = 1) {
    this.multiplier = scoreMultiplier;
  }

  get value(): number {
    return this.discrete + Math.floor(this.survival);
  }

  addKill(scoreValue: number): void {
    this.discrete += Math.round(scoreValue * this.multiplier);
  }

  addPickup(kind: PickupKind): void {
    this.discrete += Math.round(PICKUP_BONUS[kind] * this.multiplier);
  }

  addSurvival(dt: number): void {
    this.survival += dt * SURVIVAL_RATE * this.multiplier;
  }
}
