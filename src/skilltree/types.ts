/**
 * Skill Tree schema — the data shape a hand-authored tree file conforms to
 * (ADR 0003: a curated web of ~25–35 Nodes whose effects are passive numeric
 * modifiers only, flat or percent, stacking additively). Kept pure and
 * canvas-free: this module describes Nodes; `graph.ts` queries them and
 * `modifiers.ts` reduces owned Nodes into a `RunModifiers` value.
 *
 * Node positions live in an abstract tree coordinate space, NOT the 480×270
 * playfield — the Console pans a camera over the tree, so coordinates only need
 * to be internally consistent for layout, not to fit any screen.
 */

/**
 * The complete catalogue of stats a Node effect may target. Every entry already
 * flows through a v1 pure module (HP, Ammo, Boost, turn rate, projectile stats,
 * pickup amounts, drop chances, SP/Score gain), so a modifier is expressible
 * without inventing new gameplay (ADR 0003).
 */
export type Stat =
  | 'maxHp'
  | 'turnRate'
  | 'maxBoost'
  | 'boostRegen'
  | 'maxAmmo'
  | 'projectileSpeed'
  | 'projectileDamage'
  | 'fireRate'
  | 'ammoPickupAmount'
  | 'boostPickupAmount'
  | 'ammoDropChance'
  | 'spPickupValue'
  | 'scoreMultiplier';

/** How an effect's `amount` combines with a base stat. See modifiers.ts for the formula. */
export type EffectKind = 'flat' | 'percent';

/**
 * One passive modifier a Node grants. `percent` amounts are fractions
 * (0.1 = +10%), `flat` amounts are in the stat's own units. Effects stack
 * additively across every owned Node (ADR 0003).
 */
export interface Effect {
  stat: Stat;
  kind: EffectKind;
  amount: number;
}

/**
 * A single purchasable point in the Skill Tree (CONTEXT.md: "A Node grants one
 * passive effect and can only be bought when adjacent to an already-owned Node
 * or the root"). A Node may carry more than one Effect, but conceptually reads
 * as one themed upgrade.
 *
 * `edges` lists the ids of adjacent Nodes; adjacency must be symmetric across
 * the tree (validated by `validateTree`). `x` / `y` are abstract layout
 * coordinates.
 */
export interface NodeDef {
  id: string;
  label: string;
  /** SP cost to buy this Node. The root costs 0 and is owned implicitly. */
  cost: number;
  effects: Effect[];
  x: number;
  y: number;
  /** Ids of Nodes directly connected to this one. */
  edges: string[];
}

/** A whole Skill Tree: a set of Nodes and the id of the implicitly-owned root. */
export interface SkillTree {
  root: string;
  nodes: NodeDef[];
}
