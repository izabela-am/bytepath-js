import { describe, it, expect } from 'vitest';
import {
  Director,
  roundBudget,
  ENEMY_COST,
  ROUND_DURATION,
  RESOURCE_INTERVAL,
  type EnemyName,
  type ResourceName,
} from './Director';

const FIXED_DT = 1 / 60;

/** A deterministic fake RNG cycling through a fixed sequence in [0, 1). */
function fakeRand(sequence: number[]): () => number {
  let i = 0;
  return () => {
    const v = sequence[i % sequence.length] as number;
    i += 1;
    return v;
  };
}

/** Build a Director plus recorders for its spawn callbacks. */
function makeDirector(rand?: () => number) {
  const enemies: EnemyName[] = [];
  const resources: ResourceName[] = [];
  const director = new Director({
    spawnEnemy: (name) => {
      enemies.push(name);
    },
    spawnResource: (name) => {
      resources.push(name);
    },
    ...(rand ? { rand } : {}),
  });
  return { director, enemies, resources };
}

/** Feed `seconds` of fixed-dt ticks to the Director. */
function advance(director: Director, seconds: number): void {
  const ticks = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < ticks; i++) director.update(FIXED_DT);
}

describe('Director difficulty escalation', () => {
  it('starts at difficulty 1', () => {
    const { director } = makeDirector();
    expect(director.difficulty).toBe(1);
  });

  it('increases difficulty at each ROUND_DURATION boundary', () => {
    const { director } = makeDirector();

    advance(director, ROUND_DURATION - 1);
    expect(director.difficulty).toBe(1);

    advance(director, 1);
    expect(director.difficulty).toBe(2);

    advance(director, ROUND_DURATION);
    expect(director.difficulty).toBe(3);
  });

  it('handles a difficulty boundary crossed within a single large tick', () => {
    const { director } = makeDirector();
    director.update(ROUND_DURATION * 2 + 1);
    expect(director.difficulty).toBe(3);
  });

  it('tracks elapsed time', () => {
    const { director } = makeDirector();
    advance(director, 10);
    expect(director.elapsed).toBeCloseTo(10, 5);
  });
});

describe('Director budget growth', () => {
  it('grows monotonically with difficulty', () => {
    let prev = -Infinity;
    for (let d = 1; d <= 20; d++) {
      const b = roundBudget(d);
      expect(b).toBeGreaterThan(prev);
      prev = b;
    }
  });

  it('grants at least a few points at difficulty 1', () => {
    expect(roundBudget(1)).toBeGreaterThanOrEqual(ENEMY_COST.Shooter);
  });
});

describe('Director enemy spawning', () => {
  it('only spawns valid enemy names', () => {
    const { director, enemies } = makeDirector(fakeRand([0.5]));
    advance(director, ROUND_DURATION * 3);
    expect(enemies.length).toBeGreaterThan(0);
    for (const name of enemies) {
      expect(['Rock', 'Shooter']).toContain(name);
    }
  });

  it('never spends more than the round budget on enemies', () => {
    // rand fixed low so pickAffordableEnemy would prefer Shooter when allowed;
    // still, total cost within a single round must not exceed that round's budget.
    const { director, enemies } = makeDirector(fakeRand([0.1]));

    // Difficulty 1 round only: advance just under one full round so no new
    // budget is granted, and every spawn interval has time to fire.
    advance(director, ROUND_DURATION - FIXED_DT);

    const spent = enemies.reduce((sum, name) => sum + ENEMY_COST[name], 0);
    expect(spent).toBeLessThanOrEqual(roundBudget(1));
  });

  it('does not spawn Shooters at difficulty 1', () => {
    const { director, enemies } = makeDirector(fakeRand([0.1]));
    advance(director, ROUND_DURATION - FIXED_DT);
    expect(enemies).not.toContain('Shooter');
  });

  it('can spawn Shooters once difficulty >= 2 and budget allows', () => {
    // Bias rand low so pickAffordableEnemy chooses Shooter when it can.
    const { director, enemies } = makeDirector(fakeRand([0.1]));
    advance(director, ROUND_DURATION * 2);
    expect(enemies).toContain('Shooter');
  });
});

describe('Director resource cadence', () => {
  it('spawns one resource at each RESOURCE_INTERVAL boundary', () => {
    const { director, resources } = makeDirector(fakeRand([0.0]));

    advance(director, RESOURCE_INTERVAL - 1);
    expect(resources.length).toBe(0);

    advance(director, 1);
    expect(resources.length).toBe(1);

    advance(director, RESOURCE_INTERVAL);
    expect(resources.length).toBe(2);
  });

  it('spawns only valid resource names', () => {
    const { director, resources } = makeDirector(fakeRand([0.05, 0.5, 0.9]));
    advance(director, RESOURCE_INTERVAL * 4);
    expect(resources.length).toBeGreaterThan(0);
    for (const name of resources) {
      expect(['Ammo', 'Boost', 'Attack']).toContain(name);
    }
  });

  it('applies the weighted resource distribution', () => {
    // roll < 0.6 => Boost, < 0.85 => Attack, else Ammo.
    const boost = makeDirector(fakeRand([0.3]));
    advance(boost.director, RESOURCE_INTERVAL);
    expect(boost.resources[0]).toBe('Boost');

    const attack = makeDirector(fakeRand([0.7]));
    advance(attack.director, RESOURCE_INTERVAL);
    expect(attack.resources[0]).toBe('Attack');

    const ammo = makeDirector(fakeRand([0.95]));
    advance(ammo.director, RESOURCE_INTERVAL);
    expect(ammo.resources[0]).toBe('Ammo');
  });
});

describe('Director determinism', () => {
  it('produces identical spawn sequences given the same seeded rand and dt feed', () => {
    const seed = [0.12, 0.87, 0.44, 0.03, 0.66, 0.29, 0.51, 0.9, 0.18, 0.72];

    const a = makeDirector(fakeRand([...seed]));
    const b = makeDirector(fakeRand([...seed]));

    advance(a.director, ROUND_DURATION * 3);
    advance(b.director, ROUND_DURATION * 3);

    expect(a.enemies).toEqual(b.enemies);
    expect(a.resources).toEqual(b.resources);
    expect(a.director.difficulty).toBe(b.director.difficulty);
  });
});
