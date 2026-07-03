import { describe, it, expect } from 'vitest';
import {
  computeRunModifiers,
  identityModifiers,
  applyModifier,
  IDENTITY_MODIFIERS,
  STATS,
} from './modifiers';
import { sampleTree } from './data';

describe('RunModifiers', () => {
  it('IDENTITY_MODIFIERS is all zeros for every stat', () => {
    for (const stat of STATS) {
      expect(IDENTITY_MODIFIERS[stat]).toEqual({ flat: 0, percent: 0 });
    }
  });

  it('identity leaves any base value unchanged (base * (1 + 0) + 0)', () => {
    expect(applyModifier(100, IDENTITY_MODIFIERS.maxHp)).toBe(100);
    expect(applyModifier(3.14, IDENTITY_MODIFIERS.turnRate)).toBe(3.14);
    expect(applyModifier(0, IDENTITY_MODIFIERS.maxAmmo)).toBe(0);
  });

  it('the identity invariant: no Nodes owned equals IDENTITY_MODIFIERS', () => {
    expect(computeRunModifiers([], sampleTree)).toEqual(IDENTITY_MODIFIERS);
  });

  it('applies a single owned Node effect', () => {
    // damage: projectileDamage +5 flat
    const mods = computeRunModifiers(['damage'], sampleTree);
    expect(mods.projectileDamage).toEqual({ flat: 5, percent: 0 });
    expect(applyModifier(10, mods.projectileDamage)).toBe(15);
  });

  it('applies a percent effect via the documented formula', () => {
    // plating: maxHp +20%
    const mods = computeRunModifiers(['plating'], sampleTree);
    expect(mods.maxHp).toEqual({ flat: 0, percent: 0.2 });
    expect(applyModifier(100, mods.maxHp)).toBeCloseTo(120);
  });

  it('stacks effects additively across Nodes (percent + percent, not multiplicative)', () => {
    // plating (+20% maxHp) + hull (+25 flat maxHp)
    const mods = computeRunModifiers(['plating', 'hull'], sampleTree);
    expect(mods.maxHp).toEqual({ flat: 25, percent: 0.2 });
    // base 100 -> 100 * 1.2 + 25 = 145
    expect(applyModifier(100, mods.maxHp)).toBeCloseTo(145);
  });

  it('a Node carrying multiple effects contributes all of them', () => {
    // scavenger: ammoDropChance +5%, ammoPickupAmount +2 flat
    const mods = computeRunModifiers(['scavenger'], sampleTree);
    expect(mods.ammoDropChance).toEqual({ flat: 0, percent: 0.05 });
    expect(mods.ammoPickupAmount).toEqual({ flat: 2, percent: 0 });
  });

  it('ignores unknown owned ids and the effect-free root', () => {
    expect(computeRunModifiers(['root', 'does-not-exist'], sampleTree)).toEqual(IDENTITY_MODIFIERS);
  });

  it('identityModifiers returns a fresh mutable copy each call', () => {
    const a = identityModifiers();
    a.maxHp.flat = 99;
    expect(identityModifiers().maxHp.flat).toBe(0);
  });

  it('IDENTITY_MODIFIERS is frozen (shared read-only constant)', () => {
    expect(Object.isFrozen(IDENTITY_MODIFIERS)).toBe(true);
    expect(Object.isFrozen(IDENTITY_MODIFIERS.maxHp)).toBe(true);
  });
});
