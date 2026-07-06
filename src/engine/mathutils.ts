/**
 * Small math helpers ported from the LÖVE tutorial's utils.
 * Pure functions only — no canvas, no global state.
 */

export const TWO_PI = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** `t` is not clamped. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Uniform random float in [min, max). If only one argument is given, [0, min). */
export function randomRange(min: number, max?: number): number {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return min + Math.random() * (max - min);
}

/** Uniform random integer in the inclusive range [min, max]. */
export function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function randomChoice<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('randomChoice: empty array');
  }
  return items[randomInt(0, items.length - 1)] as T;
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angle(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function vectorFromAngle(radians: number, magnitude = 1): { x: number; y: number } {
  return { x: Math.cos(radians) * magnitude, y: Math.sin(radians) * magnitude };
}

/**
 * Shortest signed difference between two angles, wrapped to (-PI, PI].
 * Useful for steering the Ship toward a heading without spinning the long way.
 */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}
