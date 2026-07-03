import { describe, it, expect } from 'vitest';
import { ATTACKS, NEUTRAL_ATTACK, DEFAULT_FIRE_INTERVAL } from './attacks';

const DEG = Math.PI / 180;

describe('Attack table', () => {
  it('Neutral is free and fires one straight shot', () => {
    expect(NEUTRAL_ATTACK.name).toBe('Neutral');
    expect(NEUTRAL_ATTACK.ammoCost).toBe(0);
    expect(NEUTRAL_ATTACK.fireInterval).toBe(DEFAULT_FIRE_INTERVAL);
    expect(NEUTRAL_ATTACK.spawn.shots).toHaveLength(1);
    expect(NEUTRAL_ATTACK.spawn.shots[0]?.angleOffset).toBe(0);
  });

  it('Double costs 2 and fires a symmetric +/-12 degree pair', () => {
    const a = ATTACKS.Double;
    expect(a.ammoCost).toBe(2);
    expect(a.spawn.shots).toHaveLength(2);
    const offsets = a.spawn.shots.map((s) => s.angleOffset).sort((x, y) => x - y);
    expect(offsets[0]).toBeCloseTo(-12 * DEG, 9);
    expect(offsets[1]).toBeCloseTo(12 * DEG, 9);
  });

  it('Spread costs 1, fires one jittered shot, and cycles faster', () => {
    const a = ATTACKS.Spread;
    expect(a.ammoCost).toBe(1);
    expect(a.spawn.shots).toHaveLength(1);
    expect(a.spawn.shots[0]?.randomSpreadHalfAngle).toBeCloseTo(16 * DEG, 9);
    expect(a.fireInterval).toBeLessThan(DEFAULT_FIRE_INTERVAL);
    expect(a.fireInterval).toBe(0.16);
  });

  it('each Attack has a distinct display color', () => {
    const colors = [ATTACKS.Neutral.color, ATTACKS.Double.color, ATTACKS.Spread.color];
    expect(new Set(colors).size).toBe(colors.length);
  });
});
