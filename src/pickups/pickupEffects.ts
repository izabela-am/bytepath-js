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

/** Base SP an SP pickup banks before the `spPickupValue` stat is applied. */
export const SP_PICKUP_BASE_VALUE = 1;

/**
 * Resolve how much SP one SP pickup banks. The caller passes the already-applied
 * effective value (`applyModifier(SP_PICKUP_BASE_VALUE, mods.spPickupValue)`),
 * keeping this module free of any Skill Tree import — coupling stays
 * one-directional (rooms depend on skilltree; pure modules stay standalone).
 *
 * SP is a whole-number currency, so the effective value is rounded to the
 * nearest integer and floored at 0 (a modifier can never bank negative SP).
 * With the identity modifier the effective value is `SP_PICKUP_BASE_VALUE`
 * (1), so `resolveSpPickupValue(1)` is `1` — v1-equivalent behavior.
 */
export function resolveSpPickupValue(effectiveValue: number): number {
  return Math.max(0, Math.round(effectiveValue));
}

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
