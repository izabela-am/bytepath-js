/**
 * RunModifiers — the reducer from owned Skill Tree Nodes to the numeric bundle a
 * Run reads at launch (ADR 0002: "Run rules are snapshotted at launch"; ADR 0003:
 * passive numeric modifiers only, stacking additively). Pure and canvas-free.
 *
 * ## Application formula
 *
 * For every stat, a modifier carries an additive `flat` term and an additive
 * `percent` term. A Run applies them to a base stat value as:
 *
 *     effective = base * (1 + percent) + flat
 *
 * ## Identity invariant
 *
 * `IDENTITY_MODIFIERS` is all zeros. Under the formula above that yields
 * `base * (1 + 0) + 0 === base` for every stat — so a fresh save (no Nodes
 * owned) reproduces v1 behavior exactly. The v1 pure modules stay valid
 * untouched (ADR 0003). `computeRunModifiers([], tree)` MUST equal
 * `IDENTITY_MODIFIERS`.
 *
 * Effects stack additively: owning two Nodes that each grant `+10%` to a stat
 * gives `percent = 0.2` (a +20% multiplier), not `1.1 * 1.1`.
 */
import type { SkillTree, Stat } from './types';

/** All stats, in a stable order — the single source of truth for iteration. */
export const STATS: readonly Stat[] = [
  'maxHp',
  'turnRate',
  'maxBoost',
  'boostRegen',
  'maxAmmo',
  'projectileSpeed',
  'projectileDamage',
  'fireRate',
  'ammoPickupAmount',
  'boostPickupAmount',
  'ammoDropChance',
  'spPickupValue',
  'scoreMultiplier',
];

export interface StatModifier {
  flat: number;
  percent: number;
}

export type RunModifiers = Record<Stat, StatModifier>;

export function identityModifiers(): RunModifiers {
  const mods = {} as RunModifiers;
  for (const stat of STATS) {
    mods[stat] = { flat: 0, percent: 0 };
  }

  return mods;
}

/**
 * The canonical identity value. Frozen so it can be shared as a read-only
 * constant; call {@link identityModifiers} when a mutable copy is needed.
 */
export const IDENTITY_MODIFIERS: RunModifiers = Object.freeze(
  (() => {
    const mods = identityModifiers();
    for (const stat of STATS) Object.freeze(mods[stat]);

    return mods;
  })(),
) as RunModifiers;

/**
 * Unknown ids and the (implicitly-owned, effect-free) root contribute nothing.
 * With no owned Nodes the result equals {@link IDENTITY_MODIFIERS}.
 */
export function computeRunModifiers(ownedNodeIds: readonly string[], tree: SkillTree): RunModifiers {
  const mods = identityModifiers();
  const owned = new Set(ownedNodeIds);
  for (const node of tree.nodes) {
    if (!owned.has(node.id)) continue;
    for (const effect of node.effects) {
      const stat = mods[effect.stat];
      if (effect.kind === 'flat') stat.flat += effect.amount;
      else stat.percent += effect.amount;
    }
  }

  return mods;
}

export function applyModifier(base: number, mod: StatModifier): number {
  return base * (1 + mod.percent) + mod.flat;
}
