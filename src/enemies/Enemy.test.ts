import { describe, it, expect } from 'vitest';
import { Enemy, ENEMY_DEFAULT_HP, spawnPointOnEdge } from './Enemy';
import { Rock, ROCK_SCORE, ROCK_HP, ROCK_RADIUS } from './Rock';
import { Shooter, SHOOTER_SCORE, SHOOTER_HP } from './Shooter';
import { EnemyProjectile, ENEMY_PROJECTILE_DAMAGE } from './EnemyProjectile';
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from '../game/constants';

/** Minimal concrete Enemy for exercising the shared base rules in isolation. */
class TestEnemy extends Enemy {
  deaths = 0;
  constructor(hp = ENEMY_DEFAULT_HP) {
    super(0, 0, 100, hp);
  }
  update(dt: number): void {
    this.tickFlash(dt);
  }
  draw(): void {
    /* not exercised in canvas-free tests */
  }
  protected override die(): void {
    this.deaths += 1;
    super.die();
  }
}

describe('Enemy base rules', () => {
  it('defaults to 100 HP', () => {
    const e = new TestEnemy();
    expect(e.hp).toBe(100);
  });

  it('takeDamage reduces HP without dying above 0', () => {
    const e = new TestEnemy();
    e.takeDamage(40);
    expect(e.hp).toBe(60);
    expect(e.dead).toBe(false);
  });

  it('dies when HP reaches 0', () => {
    const e = new TestEnemy();
    e.takeDamage(100);
    expect(e.hp).toBe(0);
    expect(e.dead).toBe(true);
  });

  it('dies when HP is driven below 0 and clamps HP to 0', () => {
    const e = new TestEnemy();
    e.takeDamage(150);
    expect(e.hp).toBe(0);
    expect(e.dead).toBe(true);
  });

  it('runs the death hook exactly once', () => {
    const e = new TestEnemy();
    e.takeDamage(100);
    e.takeDamage(100); // ignored — already dead
    expect(e.deaths).toBe(1);
  });

  it('ignores damage after death', () => {
    const e = new TestEnemy();
    e.takeDamage(100);
    e.takeDamage(50);
    expect(e.hp).toBe(0);
  });

  it('sets the hit-flash on damage and fades it over time', () => {
    const e = new TestEnemy();
    e.takeDamage(10);
    expect(e.flashing).toBe(true);
    // Advance well past the flash duration.
    for (let i = 0; i < 60; i++) e.update(1 / 60);
    expect(e.flashing).toBe(false);
  });
});

describe('spawnPointOnEdge', () => {
  const mid = (min: number, max: number) => (min + max) / 2;

  it('places points just outside the requested edge', () => {
    const left = spawnPointOnEdge('left', mid);
    expect(left.x).toBeLessThan(0);

    const right = spawnPointOnEdge('right', mid);
    expect(right.x).toBeGreaterThan(PLAYFIELD_WIDTH);

    const top = spawnPointOnEdge('top', mid);
    expect(top.y).toBeLessThan(0);

    const bottom = spawnPointOnEdge('bottom', mid);
    expect(bottom.y).toBeGreaterThan(PLAYFIELD_HEIGHT);
  });
});

describe('Rock', () => {
  it('has the documented score, HP and collision radius', () => {
    const rock = new Rock();
    expect(rock.scoreValue).toBe(ROCK_SCORE);
    expect(ROCK_SCORE).toBe(100);
    expect(rock.hp).toBe(ROCK_HP);
    expect(rock.radius).toBe(ROCK_RADIUS);
  });

  it('moves each update tick', () => {
    const rock = new Rock();
    const x0 = rock.x;
    const y0 = rock.y;
    rock.update(1 / 60);
    expect(rock.x !== x0 || rock.y !== y0).toBe(true);
  });

  it('dies via takeDamage', () => {
    const rock = new Rock();
    rock.takeDamage(ROCK_HP);
    expect(rock.dead).toBe(true);
  });
});

describe('Shooter', () => {
  it('has the documented score and HP', () => {
    const shooter = new Shooter(() => null);
    expect(shooter.scoreValue).toBe(SHOOTER_SCORE);
    expect(SHOOTER_SCORE).toBe(150);
    expect(shooter.hp).toBe(SHOOTER_HP);
  });

  it('dies via takeDamage', () => {
    const shooter = new Shooter(() => ({ x: 0, y: 0 }));
    shooter.takeDamage(SHOOTER_HP);
    expect(shooter.dead).toBe(true);
  });
});

describe('EnemyProjectile', () => {
  it('exposes a default damage of 10', () => {
    const p = new EnemyProjectile(0, 0, 0);
    expect(p.damage).toBe(ENEMY_PROJECTILE_DAMAGE);
    expect(ENEMY_PROJECTILE_DAMAGE).toBe(10);
  });

  it('travels along its heading', () => {
    // heading 0 => +x direction
    const p = new EnemyProjectile(100, 100, 0, 120);
    p.update(1 / 60);
    expect(p.x).toBeGreaterThan(100);
    expect(p.y).toBeCloseTo(100, 5);
  });

  it('dies after leaving the playfield', () => {
    const p = new EnemyProjectile(PLAYFIELD_WIDTH - 1, 100, 0, 120);
    for (let i = 0; i < 60; i++) p.update(1 / 60);
    expect(p.dead).toBe(true);
  });
});
