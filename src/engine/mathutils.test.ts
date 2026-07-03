import { describe, it, expect } from 'vitest';
import {
  clamp,
  lerp,
  randomRange,
  randomInt,
  randomChoice,
  distance,
  angle,
  vectorFromAngle,
  angleDelta,
  TWO_PI,
} from './mathutils';

describe('clamp', () => {
  it('clamps below, within, and above range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(50, 0, 10)).toBe(10);
  });
});

describe('lerp', () => {
  it('interpolates endpoints and midpoint', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
  it('extrapolates beyond [0,1]', () => {
    expect(lerp(0, 10, 2)).toBe(20);
  });
});

describe('randomRange', () => {
  it('stays within [min, max) over many samples', () => {
    for (let i = 0; i < 1000; i += 1) {
      const v = randomRange(5, 8);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(8);
    }
  });
  it('treats a single argument as [0, arg)', () => {
    for (let i = 0; i < 200; i += 1) {
      const v = randomRange(3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(3);
    }
  });
});

describe('randomInt', () => {
  it('is inclusive of both bounds and returns integers', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) {
      const v = randomInt(1, 3);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([1, 2, 3]));
  });
});

describe('randomChoice', () => {
  it('returns an element from the array', () => {
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i += 1) {
      expect(items).toContain(randomChoice(items));
    }
  });
  it('throws on empty array', () => {
    expect(() => randomChoice([])).toThrow();
  });
});

describe('distance', () => {
  it('computes a 3-4-5 triangle', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
  });
});

describe('angle', () => {
  it('points right along +x and down along +y', () => {
    expect(angle(0, 0, 1, 0)).toBeCloseTo(0);
    expect(angle(0, 0, 0, 1)).toBeCloseTo(Math.PI / 2);
  });
});

describe('vectorFromAngle', () => {
  it('produces a unit vector by default', () => {
    const v = vectorFromAngle(0);
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0);
  });
  it('scales by magnitude', () => {
    const v = vectorFromAngle(Math.PI / 2, 5);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(5);
  });
});

describe('angleDelta', () => {
  it('takes the short way around the circle', () => {
    // From nearly a full turn to zero is a tiny positive step, not a big one.
    expect(angleDelta(TWO_PI - 0.1, 0)).toBeCloseTo(0.1);
    expect(angleDelta(0, TWO_PI - 0.1)).toBeCloseTo(-0.1);
  });
  it('is zero for equal angles', () => {
    expect(angleDelta(1.234, 1.234)).toBeCloseTo(0);
  });
});
