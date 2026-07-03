import { describe, it, expect, vi } from 'vitest';
import { Timer, Easing } from './timer';

/** Advance a timer by `total` seconds in `steps` equal ticks. */
function advance(timer: Timer, total: number, steps: number): void {
  const dt = total / steps;
  for (let i = 0; i < steps; i += 1) timer.update(dt);
}

describe('Timer.after', () => {
  it('fires once after the delay, not before', () => {
    const timer = new Timer();
    const fn = vi.fn();
    timer.after(1, fn);

    advance(timer, 0.9, 9);
    expect(fn).not.toHaveBeenCalled();

    advance(timer, 0.2, 2);
    expect(fn).toHaveBeenCalledTimes(1);

    advance(timer, 5, 5);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(timer.size).toBe(0);
  });
});

describe('Timer.every', () => {
  it('fires on each interval boundary', () => {
    const timer = new Timer();
    const fn = vi.fn();
    timer.every(0.5, fn);

    advance(timer, 2, 20);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('stops after `count` fires', () => {
    const timer = new Timer();
    const fn = vi.fn();
    timer.every(0.1, fn, 3);

    advance(timer, 1, 100);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(timer.size).toBe(0);
  });

  it('catches up multiple fires within one large dt', () => {
    const timer = new Timer();
    const fn = vi.fn();
    timer.every(0.1, fn);
    timer.update(0.35); // spans three intervals
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('Timer.tween', () => {
  it('reaches the target value and fires onComplete', () => {
    const timer = new Timer();
    const target = { x: 0 };
    const done = vi.fn();
    timer.tween(1, target, { x: 100 }, Easing.linear, done);

    advance(timer, 0.5, 5);
    expect(target.x).toBeCloseTo(50, 1);

    advance(timer, 0.6, 6);
    expect(target.x).toBeCloseTo(100);
    expect(done).toHaveBeenCalledTimes(1);
    expect(timer.size).toBe(0);
  });

  it('tweens multiple properties at once', () => {
    const timer = new Timer();
    const target = { a: 10, b: -10 };
    timer.tween(1, target, { a: 20, b: 10 });
    advance(timer, 1, 10);
    expect(target.a).toBeCloseTo(20);
    expect(target.b).toBeCloseTo(10);
  });

  it('applies easing (inOutCubic passes through 0.5 at the midpoint)', () => {
    const timer = new Timer();
    const target = { x: 0 };
    timer.tween(1, target, { x: 1 }, Easing.inOutCubic);
    advance(timer, 0.5, 5);
    expect(target.x).toBeCloseTo(0.5, 2);
  });

  it('handles zero-duration tweens by snapping to target', () => {
    const timer = new Timer();
    const target = { x: 0 };
    const done = vi.fn();
    timer.tween(0, target, { x: 42 }, Easing.linear, done);
    timer.update(0.016);
    expect(target.x).toBe(42);
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('Easing functions', () => {
  it('linear maps endpoints', () => {
    expect(Easing.linear(0)).toBe(0);
    expect(Easing.linear(1)).toBe(1);
  });
  it('inOutCubic maps endpoints and midpoint', () => {
    expect(Easing.inOutCubic(0)).toBeCloseTo(0);
    expect(Easing.inOutCubic(1)).toBeCloseTo(1);
    expect(Easing.inOutCubic(0.5)).toBeCloseTo(0.5);
  });
  it('outBack overshoots past 1 before the end', () => {
    expect(Easing.outBack(0)).toBeCloseTo(0);
    expect(Easing.outBack(1)).toBeCloseTo(1);
    // Somewhere in the back half it exceeds the target.
    const peak = Math.max(...[0.6, 0.7, 0.8].map(Easing.outBack));
    expect(peak).toBeGreaterThan(1);
  });
});

describe('cancellation', () => {
  it('cancel(handle) removes a single entry', () => {
    const timer = new Timer();
    const fn = vi.fn();
    const handle = timer.after(1, fn);
    timer.cancel(handle);
    advance(timer, 2, 2);
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancelTag removes all entries with that tag', () => {
    const timer = new Timer();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    timer.after(0.5, a, 'group');
    timer.every(0.2, b, Infinity, 'group');
    timer.after(0.5, c, 'other');

    timer.cancelTag('group');
    advance(timer, 1, 10);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
    expect(c).toHaveBeenCalledTimes(1);
  });

  it('cancelling within a callback is safe', () => {
    const timer = new Timer();
    const later = vi.fn();
    const handle = timer.after(1, later);
    timer.after(0.5, () => timer.cancel(handle));
    advance(timer, 2, 20);
    expect(later).not.toHaveBeenCalled();
  });
});

describe('Timer.during', () => {
  it('runs each tick for the duration then completes', () => {
    const timer = new Timer();
    const tick = vi.fn();
    const done = vi.fn();
    timer.during(0.3, tick, done);
    advance(timer, 0.3, 3);
    expect(tick).toHaveBeenCalledTimes(3);
    expect(done).toHaveBeenCalledTimes(1);
  });
});
