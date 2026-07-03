import { describe, it, expect } from 'vitest';
import {
  Projectile,
  PROJECTILE_SPEED,
  PROJECTILE_RADIUS,
  PROJECTILE_DAMAGE,
} from './Projectile';
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from '../game/constants';

describe('Projectile', () => {
  it('has a collision radius and default damage', () => {
    const p = new Projectile(0, 0, { angle: 0 });
    expect(p.radius).toBe(PROJECTILE_RADIUS);
    expect(p.damage).toBe(PROJECTILE_DAMAGE);
  });

  it('moves at PROJECTILE_SPEED along its heading', () => {
    const p = new Projectile(100, 100, { angle: 0 }); // +x
    p.update(1);
    expect(p.x).toBeCloseTo(100 + PROJECTILE_SPEED, 6);
    expect(p.y).toBeCloseTo(100, 6);
  });

  it('moves downward for a heading of PI/2', () => {
    const p = new Projectile(100, 100, { angle: Math.PI / 2 });
    p.update(0.5);
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(100 + PROJECTILE_SPEED * 0.5, 6);
  });

  it('dies once it leaves the playfield', () => {
    const p = new Projectile(PLAYFIELD_WIDTH - 1, PLAYFIELD_HEIGHT / 2, { angle: 0 });
    expect(p.dead).toBe(false);
    // At 200 px/s a single 1 s step carries it well past the right edge.
    p.update(1);
    expect(p.dead).toBe(true);
  });

  it('stays alive while inside the playfield', () => {
    const p = new Projectile(10, 10, { angle: 0 });
    p.update(1 / 60);
    expect(p.dead).toBe(false);
  });

  it('accepts a custom damage value', () => {
    const p = new Projectile(0, 0, { angle: 0, damage: 250 });
    expect(p.damage).toBe(250);
  });
});
