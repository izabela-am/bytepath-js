/**
 * A small sample Skill Tree — exercises the schema for tests and demonstrates the
 * hand-authoring shape a content agent will scale to the full ~25–35 Node tree
 * (ADR 0003). NOT the shipped tree; costs and effects here are illustrative.
 *
 * Layout (abstract tree coordinates, not the playfield): the root sits at the
 * origin with three branches radiating out — offense (right), defense (left),
 * economy (down).
 *
 *            hull(-1,-1)   plating(-2,-1)
 *                 \        /
 *   damage ── rapid       root ── thruster ── agility
 *   (1,-1)   (1,0)       (0,0)    (0,1)       (0,2)
 *                 \       /
 *              scavenger(1,1)
 *
 * Authoring notes for the full tree:
 *  - `edges` must be symmetric — list the connection on BOTH Nodes.
 *  - `percent` amounts are fractions (0.1 = +10%); `flat` amounts are stat units.
 *  - Every non-root Node needs a positive `cost` and a path back to the root.
 *  - Run `validateTree(sampleTree)` in a test to catch authoring slips early.
 */
import type { SkillTree } from './types';

export const sampleTree: SkillTree = {
  root: 'root',
  nodes: [
    {
      id: 'root',
      label: 'Core',
      cost: 0,
      effects: [],
      x: 0,
      y: 0,
      edges: ['rapid', 'plating', 'thruster'],
    },
    // Offense branch (right).
    {
      id: 'rapid',
      label: 'Rapid Fire',
      cost: 1,
      effects: [{ stat: 'fireRate', kind: 'percent', amount: 0.1 }],
      x: 1,
      y: 0,
      edges: ['root', 'damage', 'scavenger'],
    },
    {
      id: 'damage',
      label: 'Heavy Rounds',
      cost: 2,
      effects: [{ stat: 'projectileDamage', kind: 'flat', amount: 5 }],
      x: 1,
      y: -1,
      edges: ['rapid'],
    },
    {
      id: 'scavenger',
      label: 'Scavenger',
      cost: 2,
      effects: [
        { stat: 'ammoDropChance', kind: 'percent', amount: 0.05 },
        { stat: 'ammoPickupAmount', kind: 'flat', amount: 2 },
      ],
      x: 1,
      y: 1,
      edges: ['rapid'],
    },
    // Defense branch (left).
    {
      id: 'plating',
      label: 'Reinforced Plating',
      cost: 2,
      effects: [{ stat: 'maxHp', kind: 'percent', amount: 0.2 }],
      x: -2,
      y: -1,
      edges: ['root', 'hull'],
    },
    {
      id: 'hull',
      label: 'Hull Bracing',
      cost: 3,
      effects: [{ stat: 'maxHp', kind: 'flat', amount: 25 }],
      x: -1,
      y: -1,
      edges: ['plating'],
    },
    // Economy branch (down).
    {
      id: 'thruster',
      label: 'Thruster Tuning',
      cost: 1,
      effects: [{ stat: 'maxBoost', kind: 'flat', amount: 10 }],
      x: 0,
      y: 1,
      edges: ['root', 'agility'],
    },
    {
      id: 'agility',
      label: 'Agility Servos',
      cost: 2,
      effects: [{ stat: 'turnRate', kind: 'percent', amount: 0.15 }],
      x: 0,
      y: 2,
      edges: ['thruster'],
    },
  ],
};

/**
 * The shipped Skill Tree — the real, hand-curated web the Console renders
 * (ADR 0003: ~25–35 Nodes, passive numeric modifiers only, stacking additively).
 *
 * ## Layout (abstract tree coordinates, not the 480×270 playfield)
 *
 * The Core sits at the origin; five themed branches radiate out so a route is a
 * meaningful choice. Costs escalate with graph distance from the Core: a first
 * ring at 2–3 SP, mid rings at 4–6 then 8–11, and a rim of "keystone-ish" Nodes
 * (still plain numeric, just bigger) at 14–18. Node ids are prefixed to stay
 * clearly distinct from the illustrative `sampleTree` above.
 *
 *   NORTH  survival  (maxHp, maxHp%, boostRegen, maxBoost, HP keystone)
 *   EAST   gunnery   (fireRate, projectileDamage, projectileSpeed, maxAmmo, dmg keystone)
 *   SOUTH  greed     (ammoPickup, boostPickup, ammoDropChance, spPickupValue keystone)
 *   WEST   handling  (turnRate, maxBoost, turnRate, maxBoost keystone)
 *   SW     scoring   (scoreMultiplier chain → GLORY keystone)
 *
 * ## Economy / pacing (ADR 0003)
 *
 * SP pickups grant 1 SP each; a decent Run banks ~4–7 SP. First-ring Nodes cost
 * 2–3 SP (buyable inside 1–2 Runs). The full tree totals 207 SP, so completing
 * it takes roughly 207 / ~6 ≈ 35 decent Runs — squarely in the 30–50 target.
 *
 * Per-branch cost sums (each branch = first ring outward to its keystone):
 *   survival  sHull 2 + sPlate 4 + sRegen 5 + sReserve 6 + sBulwark 15 = 32
 *   gunnery   gRapid 3 + gHeavy 4 + gVeloc 6 + gMag 9 + gOver 16       = 38
 *   greed     eScav 3 + eMagnet 6 + eVeins 5 + eValue 10 + eJackpot 14 = 38
 *   handling  hAgile 2 + hThrust 4 + hNimble 9 + hAfter 14             = 29
 *   scoring   scFocusIn 3 + scCombo 6 + scStreak 11 + scGlory 18       = 38
 *   bridges   bridgeNW 5 + bridgeNE 6 + bridgeSE 10 + bridgeSW 11      = 32
 *   core 0
 *   ----------------------------------------------------------------
 *   TOTAL = 32 + 38 + 38 + 29 + 38 + 32 = 207   ← within 200–280 (28 Nodes)
 *
 * First-ring costs (all ≤ 3): sHull 2, gRapid 3, eScav 3, hAgile 2, scFocusIn 3.
 */
export const skillTree: SkillTree = {
  root: 'core',
  nodes: [
    {
      id: 'core',
      label: 'CORE',
      cost: 0,
      effects: [],
      x: 0,
      y: 0,
      edges: ['sHull', 'gRapid', 'eScav', 'hAgile', 'scFocusIn'],
    },

    // ── NORTH: survival branch (maxHp, regen, boost pool) ──────────────
    {
      id: 'sHull',
      label: 'HULL+',
      cost: 2,
      effects: [{ stat: 'maxHp', kind: 'flat', amount: 10 }],
      x: 0,
      y: -2,
      edges: ['core', 'sPlate', 'bridgeNW', 'bridgeNE'],
    },
    {
      id: 'sPlate',
      label: 'PLATING',
      cost: 4,
      effects: [{ stat: 'maxHp', kind: 'percent', amount: 0.08 }],
      x: 0,
      y: -4,
      edges: ['sHull', 'sRegen', 'sReserve'],
    },
    {
      id: 'sRegen',
      label: 'COOLANT',
      cost: 5,
      effects: [{ stat: 'boostRegen', kind: 'percent', amount: 0.1 }],
      x: -1.5,
      y: -5.5,
      edges: ['sPlate', 'sBulwark'],
    },
    {
      id: 'sReserve',
      label: 'RESERVE',
      cost: 6,
      effects: [{ stat: 'maxBoost', kind: 'flat', amount: 15 }],
      x: 1.5,
      y: -5.5,
      edges: ['sPlate', 'sBulwark'],
    },
    {
      id: 'sBulwark',
      label: 'BULWARK',
      cost: 15,
      effects: [
        { stat: 'maxHp', kind: 'flat', amount: 30 },
        { stat: 'maxHp', kind: 'percent', amount: 0.1 },
      ],
      x: 0,
      y: -7,
      edges: ['sRegen', 'sReserve'],
    },

    // ── EAST: gunnery branch (fireRate, damage, speed, ammo) ───────────
    {
      id: 'gRapid',
      label: 'RAPID FIRE',
      cost: 3,
      effects: [{ stat: 'fireRate', kind: 'percent', amount: 0.08 }],
      x: 2,
      y: 0,
      edges: ['core', 'gHeavy', 'bridgeNE', 'bridgeSE'],
    },
    {
      id: 'gHeavy',
      label: 'HEAVY ROUNDS',
      cost: 4,
      effects: [{ stat: 'projectileDamage', kind: 'flat', amount: 4 }],
      x: 4,
      y: 0,
      edges: ['gRapid', 'gVeloc', 'gMag'],
    },
    {
      id: 'gVeloc',
      label: 'VELOCITY',
      cost: 6,
      effects: [{ stat: 'projectileSpeed', kind: 'percent', amount: 0.12 }],
      x: 5.5,
      y: -1.5,
      edges: ['gHeavy', 'gOver'],
    },
    {
      id: 'gMag',
      label: 'MAGAZINE',
      cost: 9,
      effects: [{ stat: 'maxAmmo', kind: 'flat', amount: 25 }],
      x: 5.5,
      y: 1.5,
      edges: ['gHeavy', 'gOver'],
    },
    {
      id: 'gOver',
      label: 'OVERCHARGE',
      cost: 16,
      effects: [
        { stat: 'projectileDamage', kind: 'percent', amount: 0.15 },
        { stat: 'fireRate', kind: 'percent', amount: 0.1 },
      ],
      x: 7,
      y: 0,
      edges: ['gVeloc', 'gMag'],
    },

    // ── SOUTH: greed branch (pickups, drop chance, SP value) ───────────
    {
      id: 'eScav',
      label: 'SCAVENGER',
      cost: 3,
      effects: [{ stat: 'ammoPickupAmount', kind: 'flat', amount: 3 }],
      x: 0,
      y: 2,
      edges: ['core', 'eMagnet', 'bridgeSE', 'bridgeSW'],
    },
    {
      id: 'eMagnet',
      label: 'MAGNET',
      cost: 6,
      effects: [{ stat: 'boostPickupAmount', kind: 'flat', amount: 8 }],
      x: 0,
      y: 4,
      edges: ['eScav', 'eVeins', 'eValue'],
    },
    {
      id: 'eVeins',
      label: 'RICH VEINS',
      cost: 5,
      effects: [{ stat: 'ammoDropChance', kind: 'percent', amount: 0.1 }],
      x: -1.5,
      y: 5.5,
      edges: ['eMagnet', 'eJackpot'],
    },
    {
      id: 'eValue',
      label: 'PROSPECTOR',
      cost: 10,
      effects: [{ stat: 'ammoDropChance', kind: 'percent', amount: 0.12 }],
      x: 1.5,
      y: 5.5,
      edges: ['eMagnet', 'eJackpot'],
    },
    {
      id: 'eJackpot',
      label: 'JACKPOT',
      cost: 14,
      effects: [{ stat: 'spPickupValue', kind: 'percent', amount: 0.25 }],
      x: 0,
      y: 7,
      edges: ['eVeins', 'eValue'],
    },

    // ── WEST: handling branch (turn rate, boost pool) ──────────────────
    {
      id: 'hAgile',
      label: 'AGILE',
      cost: 2,
      effects: [{ stat: 'turnRate', kind: 'percent', amount: 0.08 }],
      x: -2,
      y: 0,
      edges: ['core', 'hThrust', 'bridgeNW', 'bridgeSW'],
    },
    {
      id: 'hThrust',
      label: 'THRUSTERS',
      cost: 4,
      effects: [{ stat: 'maxBoost', kind: 'flat', amount: 12 }],
      x: -4,
      y: 0,
      edges: ['hAgile', 'hNimble'],
    },
    {
      id: 'hNimble',
      label: 'NIMBLE',
      cost: 9,
      effects: [{ stat: 'turnRate', kind: 'percent', amount: 0.12 }],
      x: -5.5,
      y: 0,
      edges: ['hThrust', 'hAfter'],
    },
    {
      id: 'hAfter',
      label: 'AFTERBURNER',
      cost: 14,
      effects: [
        { stat: 'maxBoost', kind: 'percent', amount: 0.2 },
        { stat: 'boostRegen', kind: 'percent', amount: 0.15 },
      ],
      x: -7,
      y: 0,
      edges: ['hNimble'],
    },

    // ── SOUTHWEST: scoring branch (scoreMultiplier chain) ──────────────
    {
      id: 'scFocusIn',
      label: 'FOCUS',
      cost: 3,
      effects: [{ stat: 'scoreMultiplier', kind: 'percent', amount: 0.05 }],
      x: -1.6,
      y: 1.6,
      edges: ['core', 'scCombo'],
    },
    {
      id: 'scCombo',
      label: 'COMBO',
      cost: 6,
      effects: [{ stat: 'scoreMultiplier', kind: 'percent', amount: 0.08 }],
      x: -3.2,
      y: 3.2,
      edges: ['scFocusIn', 'scStreak'],
    },
    {
      id: 'scStreak',
      label: 'STREAK',
      cost: 11,
      effects: [{ stat: 'scoreMultiplier', kind: 'percent', amount: 0.1 }],
      x: -4.5,
      y: 4.5,
      edges: ['scCombo', 'scGlory'],
    },
    {
      id: 'scGlory',
      label: 'GLORY',
      cost: 18,
      effects: [
        { stat: 'scoreMultiplier', kind: 'percent', amount: 0.2 },
        { stat: 'spPickupValue', kind: 'percent', amount: 0.1 },
      ],
      x: -5.8,
      y: 5.8,
      edges: ['scStreak'],
    },

    // ── Inner-ring bridges: cross-link adjacent branches so routes weave ─
    // a connected web rather than five isolated spokes.
    {
      id: 'bridgeNW',
      label: 'GYROS',
      cost: 5,
      effects: [{ stat: 'turnRate', kind: 'flat', amount: 0.4 }],
      x: -2,
      y: -2,
      edges: ['sHull', 'hAgile'],
    },
    {
      id: 'bridgeNE',
      label: 'AUTOLOADER',
      cost: 6,
      effects: [{ stat: 'maxAmmo', kind: 'flat', amount: 12 }],
      x: 2,
      y: -2,
      edges: ['sHull', 'gRapid'],
    },
    {
      id: 'bridgeSE',
      label: 'RECYCLER',
      cost: 10,
      effects: [
        { stat: 'ammoPickupAmount', kind: 'flat', amount: 4 },
        { stat: 'fireRate', kind: 'percent', amount: 0.05 },
      ],
      x: 2,
      y: 2,
      edges: ['gRapid', 'eScav'],
    },
    {
      id: 'bridgeSW',
      label: 'MOMENTUM',
      cost: 11,
      effects: [
        { stat: 'scoreMultiplier', kind: 'percent', amount: 0.06 },
        { stat: 'boostPickupAmount', kind: 'flat', amount: 5 },
      ],
      x: -2,
      y: 2,
      edges: ['hAgile', 'eScav'],
    },
  ],
};
