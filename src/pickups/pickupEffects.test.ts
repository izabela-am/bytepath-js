import { describe, it, expect, vi } from 'vitest';
import {
  applyAmmoPickup,
  applyBoostPickup,
  applyAttackPickup,
  AMMO_PICKUP_AMOUNT,
  BOOST_PICKUP_AMOUNT,
  ATTACK_PICKUP_CHOICES,
  SP_PICKUP_BASE_VALUE,
  resolveSpPickupValue,
  type AttackSink,
  type BoostSink,
} from './pickupEffects';

function fakeAttackSink(): AttackSink & { added: number; attack: string | null } {
  return {
    added: 0,
    attack: null,
    addAmmo(n) {
      this.added += n;
    },
    setAttack(name) {
      this.attack = name;
    },
  };
}

describe('pickup effects', () => {
  it('ammo pickup adds a fixed amount of Ammo', () => {
    const sink = fakeAttackSink();
    applyAmmoPickup(sink);
    expect(sink.added).toBe(AMMO_PICKUP_AMOUNT);
  });

  it('boost pickup adds and clamps to max', () => {
    const sink: BoostSink = { current: 50, max: 100 };
    const after = applyBoostPickup(sink);
    expect(after).toBe(50 + BOOST_PICKUP_AMOUNT);
    expect(sink.current).toBe(50 + BOOST_PICKUP_AMOUNT);
  });

  it('boost pickup never exceeds max', () => {
    const sink: BoostSink = { current: 90, max: 100 };
    applyBoostPickup(sink);
    expect(sink.current).toBe(100);
  });

  it('attack pickup swaps to the requested non-Neutral Attack', () => {
    const sink = fakeAttackSink();
    applyAttackPickup(sink, 'Spread');
    expect(sink.attack).toBe('Spread');
  });

  it('attack pickup choices never include Neutral', () => {
    expect(ATTACK_PICKUP_CHOICES).not.toContain('Neutral');
    expect(ATTACK_PICKUP_CHOICES.length).toBeGreaterThan(0);
  });

  it('addAmmo is invoked exactly once per ammo pickup', () => {
    const sink = fakeAttackSink();
    const spy = vi.spyOn(sink, 'addAmmo');
    applyAmmoPickup(sink);
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe('resolveSpPickupValue', () => {
  it('banks the base value (1) under the identity modifier', () => {
    // applyModifier(1, {flat:0,percent:0}) === 1.
    expect(resolveSpPickupValue(SP_PICKUP_BASE_VALUE)).toBe(1);
  });

  it('rounds a fractional effective value to the nearest integer', () => {
    expect(resolveSpPickupValue(2.4)).toBe(2);
    expect(resolveSpPickupValue(2.5)).toBe(3);
    expect(resolveSpPickupValue(1.5)).toBe(2);
  });

  it('floors at 0 so a modifier can never bank negative SP', () => {
    expect(resolveSpPickupValue(-3)).toBe(0);
    expect(resolveSpPickupValue(-0.4)).toBe(0);
  });

  it('scales up with a larger effective value', () => {
    // e.g. base 1 with +150% => applyModifier(1, {percent:1.5}) = 2.5 => 3.
    expect(resolveSpPickupValue(2.5)).toBe(3);
    expect(resolveSpPickupValue(5)).toBe(5);
  });
});
