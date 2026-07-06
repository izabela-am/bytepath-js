/**
 * Director model ported from the LÖVE tutorial: difficulty rounds grant a point
 * budget spent on enemies in randomized bursts, while resources spawn on an
 * independent cadence. Deliberately canvas-free — it only calls back out to
 * spawn functions supplied by the integrator (the Stage), so it can be
 * unit-tested with fake spawn callbacks and a seeded RNG.
 *
 * SP feeds the persistent Skill Tree currency; at 20% of a 16 s resource
 * cadence, one SP pickup surfaces roughly every ~80 s, matching the ADR 0003
 * pacing target of a first Node within 1–2 Runs. (Ammo also drops from kills —
 * that is the integrator's concern, not the Director's.)
 *
 * Determinism: all randomness flows through the injected `rand`. Given the same
 * `rand` sequence and the same `dt` feed, the Director produces exactly the
 * same spawns — that is what the tests rely on.
 */

export type EnemyName = 'Rock' | 'Shooter';

export type ResourceName = 'Ammo' | 'Boost' | 'Attack' | 'SP';

export const ROUND_DURATION = 22;

export const RESOURCE_INTERVAL = 16;

export const ENEMY_COST: Record<EnemyName, number> = {
  Rock: 1,
  Shooter: 2,
};

/**
 * Tuned tutorial-scale: difficulty 1 buys a handful of Rocks; higher
 * difficulties buy proportionally more, enough to also afford Shooters.
 */
export function roundBudget(difficulty: number): number {
  return 4 + (difficulty - 1) * 3;
}

const SPAWN_MIN_INTERVAL = 0.8;
const SPAWN_MAX_INTERVAL = 2.2;

/**
 * Order matters for the cumulative pick; weights sum to 1. SP sits between
 * Boost and Attack so a low roll still favors Boost (the most frequently spent
 * resource) while SP appears often enough to feed Skill Tree progression.
 */
const RESOURCE_WEIGHTS: ReadonlyArray<{ name: ResourceName; weight: number }> = [
  { name: 'Boost', weight: 0.45 },
  { name: 'SP', weight: 0.2 },
  { name: 'Attack', weight: 0.2 },
  { name: 'Ammo', weight: 0.15 },
];

export interface DirectorOptions {
  spawnEnemy: (name: EnemyName) => void;
  spawnResource: (name: ResourceName) => void;
  /** Injectable RNG returning [0, 1). Defaults to Math.random for production. */
  rand?: () => number;
}

export class Director {
  private readonly spawnEnemy: (name: EnemyName) => void;
  private readonly spawnResource: (name: ResourceName) => void;
  private readonly rand: () => number;

  private _difficulty = 1;

  private _elapsed = 0;

  private roundTime = 0;

  private resourceTime = 0;

  private budget: number;

  private nextSpawnIn: number;

  constructor(opts: DirectorOptions) {
    this.spawnEnemy = opts.spawnEnemy;
    this.spawnResource = opts.spawnResource;
    this.rand = opts.rand ?? Math.random;
    this.budget = roundBudget(this._difficulty);
    this.nextSpawnIn = this.rollSpawnInterval();
  }

  get difficulty(): number {
    return this._difficulty;
  }

  get elapsed(): number {
    return this._elapsed;
  }

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
      this.budget = roundBudget(this._difficulty);
    }
  }

  private updateEnemySpawns(dt: number): void {
    if (this.budget <= 0) return;
    this.nextSpawnIn -= dt;
    while (this.nextSpawnIn <= 0 && this.budget > 0) {
      const name = this.pickAffordableEnemy();
      if (name === null) break;
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
   * Shooters only appear from difficulty 2 onward; a coin flip mixes the two
   * once both are affordable, so rounds aren't monotonous.
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
