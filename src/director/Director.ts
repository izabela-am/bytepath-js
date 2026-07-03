/**
 * Director — the system that decides *what* to spawn and *when*, escalating
 * pressure over the course of a Run (CONTEXT.md). It is deliberately canvas-free
 * and holds no GameObject references: it only calls back out to spawn functions
 * supplied by the integrator (the Stage), so it can be unit-tested with fake
 * spawn callbacks and a seeded RNG.
 *
 * Model (ported from the LÖVE tutorial's Director):
 *
 *  - **Difficulty** starts at 1 and increases by 1 every ROUND_DURATION seconds.
 *    Each such interval is a "difficulty round".
 *
 *  - **Point-budget spawning.** Each round is given a point budget that grows
 *    with difficulty. Enemies cost points (Rock 1, Shooter 2). The Director
 *    spends that budget over the round in randomized bursts: it waits a random
 *    interval, then spawns one affordable enemy, subtracting its cost, until the
 *    budget for the round runs out or the round ends. A fresh budget is granted
 *    at each difficulty increase.
 *
 *  - **Resource cadence.** Independently, every RESOURCE_INTERVAL seconds the
 *    Director decides one resource spawn, weighted Boost 60% / Attack 25% /
 *    Ammo 15%. (Ammo also drops from kills — that is the integrator's concern,
 *    not the Director's.)
 *
 * Determinism: all randomness flows through the injected `rand` (default
 * `Math.random`). Given the same `rand` sequence and the same `dt` feed, the
 * Director produces exactly the same spawns — that is what the tests rely on.
 */

/** Enemy kinds the Director knows how to request. */
export type EnemyName = 'Rock' | 'Shooter';

/** Resource pickup kinds the Director knows how to request. */
export type ResourceName = 'Ammo' | 'Boost' | 'Attack';

/** Seconds per difficulty round; difficulty +1 at each boundary. */
export const ROUND_DURATION = 22;

/** Seconds between resource-spawn decisions. */
export const RESOURCE_INTERVAL = 16;

/** Point cost of each enemy kind. */
export const ENEMY_COST: Record<EnemyName, number> = {
  Rock: 1,
  Shooter: 2,
};

/**
 * Point budget granted for a difficulty round. Grows monotonically with
 * difficulty. Tuned tutorial-scale: difficulty 1 buys a handful of Rocks; higher
 * difficulties buy proportionally more, enough to also afford Shooters.
 */
export function roundBudget(difficulty: number): number {
  return 4 + (difficulty - 1) * 3;
}

/** Random wait (seconds) between enemy spawns within a round's budget spend. */
const SPAWN_MIN_INTERVAL = 0.8;
const SPAWN_MAX_INTERVAL = 2.2;

/** Weighted table for resource choice — order matters for the cumulative pick. */
const RESOURCE_WEIGHTS: ReadonlyArray<{ name: ResourceName; weight: number }> = [
  { name: 'Boost', weight: 0.6 },
  { name: 'Attack', weight: 0.25 },
  { name: 'Ammo', weight: 0.15 },
];

export interface DirectorOptions {
  /** Called to spawn one enemy of the given kind. */
  spawnEnemy: (name: EnemyName) => void;
  /** Called to spawn one resource pickup of the given kind. */
  spawnResource: (name: ResourceName) => void;
  /** Injectable RNG returning [0, 1). Defaults to Math.random for production. */
  rand?: () => number;
}

export class Director {
  private readonly spawnEnemy: (name: EnemyName) => void;
  private readonly spawnResource: (name: ResourceName) => void;
  private readonly rand: () => number;

  /** Current difficulty, starting at 1. */
  private _difficulty = 1;

  /** Total seconds elapsed since the Run started. */
  private _elapsed = 0;

  /** Time accumulated toward the next difficulty round boundary. */
  private roundTime = 0;

  /** Time accumulated toward the next resource decision. */
  private resourceTime = 0;

  /** Points remaining to spend in the current difficulty round. */
  private budget: number;

  /** Countdown to the next enemy spawn within the current round. */
  private nextSpawnIn: number;

  constructor(opts: DirectorOptions) {
    this.spawnEnemy = opts.spawnEnemy;
    this.spawnResource = opts.spawnResource;
    this.rand = opts.rand ?? Math.random;
    this.budget = roundBudget(this._difficulty);
    this.nextSpawnIn = this.rollSpawnInterval();
  }

  /** Current difficulty (>= 1), for HUD / Score use. */
  get difficulty(): number {
    return this._difficulty;
  }

  /** Seconds elapsed since the Run started, for HUD / Score use. */
  get elapsed(): number {
    return this._elapsed;
  }

  /**
   * Advance the Director by `dt` seconds. Drives difficulty escalation, budgeted
   * enemy spawning, and the resource cadence.
   */
  update(dt: number): void {
    this._elapsed += dt;

    this.updateDifficulty(dt);
    this.updateEnemySpawns(dt);
    this.updateResources(dt);
  }

  private updateDifficulty(dt: number): void {
    this.roundTime += dt;
    // Handle multiple boundaries in one tick defensively (large dt), though the
    // fixed-timestep loop never feeds more than FIXED_DT.
    while (this.roundTime >= ROUND_DURATION) {
      this.roundTime -= ROUND_DURATION;
      this._difficulty += 1;
      // New round: grant a fresh (larger) budget.
      this.budget = roundBudget(this._difficulty);
    }
  }

  private updateEnemySpawns(dt: number): void {
    if (this.budget <= 0) return;
    this.nextSpawnIn -= dt;
    while (this.nextSpawnIn <= 0 && this.budget > 0) {
      const name = this.pickAffordableEnemy();
      if (name === null) break; // nothing affordable within remaining budget
      this.budget -= ENEMY_COST[name];
      this.spawnEnemy(name);
      this.nextSpawnIn += this.rollSpawnInterval();
    }
  }

  private updateResources(dt: number): void {
    this.resourceTime += dt;
    while (this.resourceTime >= RESOURCE_INTERVAL) {
      this.resourceTime -= RESOURCE_INTERVAL;
      this.spawnResource(this.pickResource());
    }
  }

  /**
   * Pick an enemy the remaining budget can afford. Shooters (cost 2) only appear
   * from difficulty 2 onward and when the budget allows; otherwise Rocks. A coin
   * flip mixes the two once both are affordable, so rounds aren't monotonous.
   */
  private pickAffordableEnemy(): EnemyName | null {
    const canShooter = this.budget >= ENEMY_COST.Shooter && this._difficulty >= 2;
    const canRock = this.budget >= ENEMY_COST.Rock;
    if (canShooter && canRock) {
      // Bias toward Rocks; roughly 1 in 3 spawns is a Shooter when affordable.
      return this.rand() < 0.33 ? 'Shooter' : 'Rock';
    }
    if (canShooter) return 'Shooter';
    if (canRock) return 'Rock';
    return null;
  }

  /** Weighted pick of a resource kind using the injected RNG. */
  private pickResource(): ResourceName {
    const roll = this.rand();
    let cumulative = 0;
    for (const { name, weight } of RESOURCE_WEIGHTS) {
      cumulative += weight;
      if (roll < cumulative) return name;
    }
    // Floating-point guard: return the last entry if the roll grazes 1.
    return RESOURCE_WEIGHTS[RESOURCE_WEIGHTS.length - 1]!.name;
  }

  private rollSpawnInterval(): number {
    return SPAWN_MIN_INTERVAL + this.rand() * (SPAWN_MAX_INTERVAL - SPAWN_MIN_INTERVAL);
  }
}
