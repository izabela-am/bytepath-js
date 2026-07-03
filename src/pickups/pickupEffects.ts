/**
 * Pure, canvas-free description of what each Pickup does when collected
 * (CONTEXT.md: Ammo / Boost / Attack pickups). The Pickup GameObjects draw and
 * drift; when the Ship overlaps one, the Stage applies the matching effect here
 * so the "what happens on collect" rules are testable without a DOM.
 *
 * Each effect is expressed against small interfaces (a Boost sink, an Ammo/Attack
 * sink) rather than concrete classes, so the rules can be unit-tested with fakes
 * and stay decoupled from Ship / AttackSystem internals.
 */
import { clamp } from '../engine/mathutils';
import type { AttackName } from '../combat/attacks';
import type { PickupKind } from '../score/Score';

/** How much Ammo an Ammo pickup grants. */
export const AMMO_PICKUP_AMOUNT = 5;

/** How much Boost a Boost pickup grants. */
export const BOOST_PICKUP_AMOUNT = 25;

/** The Attack kinds an Attack pickup may grant (never Neutral). */
export const ATTACK_PICKUP_CHOICES: readonly AttackName[] = ['Double', 'Spread'];

/** Something that holds a clampable Boost meter (the Ship's boost state). */
export interface BoostSink {
  current: number;
  readonly max: number;
}

/** The Ammo/Attack surface an Attack/Ammo pickup drives (the AttackSystem). */
export interface AttackSink {
  addAmmo(n: number): void;
  setAttack(name: AttackName): void;
}

/**
 * Apply an Ammo pickup: add AMMO_PICKUP_AMOUNT to the Ammo pool (the sink clamps
 * to its own max).
 */
export function applyAmmoPickup(sink: AttackSink): void {
  sink.addAmmo(AMMO_PICKUP_AMOUNT);
}

/**
 * Apply a Boost pickup: add BOOST_PICKUP_AMOUNT to the Boost meter, clamped to
 * its max. Returns the new meter value for convenience.
 */
export function applyBoostPickup(sink: BoostSink): number {
  sink.current = clamp(sink.current + BOOST_PICKUP_AMOUNT, 0, sink.max);
  return sink.current;
}

/**
 * Apply an Attack pickup: swap the current Attack to `name` (a non-Neutral
 * choice picked by the caller / pickup).
 */
export function applyAttackPickup(sink: AttackSink, name: AttackName): void {
  sink.setAttack(name);
}

/** Map a Pickup kind to its Score bonus category. Identity today; kept explicit. */
export function scoreKindFor(kind: PickupKind): PickupKind {
  return kind;
}
