/**
 * Timer / tween module ported from the LÖVE tutorial's `timer` (hump-style).
 *
 * A single Timer instance schedules delayed and repeating callbacks and drives
 * property tweens on plain objects. Everything advances via `update(dt)`, so it
 * is deterministic and independent of wall-clock time — the fixed-timestep loop
 * feeds it the same `dt` every tick.
 *
 * Handles can be cancelled individually, or grouped under a string tag so a
 * caller can cancel a whole family of timers at once (e.g. all timers a
 * GameObject started, on destroy).
 */

export type EasingFn = (t: number) => number;

/** Signature for a per-tick callback used by `during`. */
type DuringFn = (elapsed: number, dt: number) => void;

interface AfterEntry {
  kind: 'after';
  tag: string | undefined;
  time: number;
  delay: number;
  fn: () => void;
}

interface EveryEntry {
  kind: 'every';
  tag: string | undefined;
  time: number;
  interval: number;
  count: number; // remaining fires, or Infinity
  fn: () => void;
}

interface TweenEntry {
  kind: 'tween';
  tag: string | undefined;
  time: number;
  duration: number;
  target: Record<string, number>;
  from: Record<string, number>;
  delta: Record<string, number>;
  keys: string[];
  easing: EasingFn;
  onComplete: (() => void) | undefined;
}

interface DuringEntry {
  kind: 'during';
  tag: string | undefined;
  time: number;
  duration: number;
  fn: DuringFn;
  onComplete: (() => void) | undefined;
}

type Entry = AfterEntry | EveryEntry | TweenEntry | DuringEntry;

/** Opaque handle returned by scheduling methods; pass to `cancel`. */
export type TimerHandle = Entry;

export const Easing = {
  linear: (t: number): number => t,

  /** Smooth acceleration then deceleration. */
  inOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

  /** Overshoots slightly past the target before settling — the classic "pop". */
  outBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
} as const;

export class Timer {
  private entries: Entry[] = [];

  /** Run `fn` once after `delay` seconds. */
  after(delay: number, fn: () => void, tag?: string): TimerHandle {
    const entry: AfterEntry = { kind: 'after', tag, time: 0, delay, fn };
    return this.push(entry);
  }

  /**
   * Run `fn` every `interval` seconds. If `count` is given, stop after that
   * many fires; otherwise repeat forever until cancelled.
   */
  every(interval: number, fn: () => void, count = Infinity, tag?: string): TimerHandle {
    const entry: EveryEntry = { kind: 'every', tag, time: 0, interval, count, fn };
    return this.push(entry);
  }

  /**
   * Tween numeric `props` on `target` toward the given values over `duration`
   * seconds. `easing` defaults to linear. `onComplete` fires after the final
   * value is applied.
   */
  tween(
    duration: number,
    target: Record<string, number>,
    props: Record<string, number>,
    easing: EasingFn = Easing.linear,
    onComplete?: () => void,
    tag?: string,
  ): TimerHandle {
    const keys = Object.keys(props);
    const from: Record<string, number> = {};
    const delta: Record<string, number> = {};
    for (const key of keys) {
      const start = target[key] ?? 0;
      from[key] = start;
      delta[key] = (props[key] as number) - start;
    }
    const entry: TweenEntry = {
      kind: 'tween',
      tag,
      time: 0,
      duration,
      target,
      from,
      delta,
      keys,
      easing,
      onComplete,
    };
    return this.push(entry);
  }

  /** Call `fn(elapsed, dt)` every tick for `duration` seconds. */
  during(
    duration: number,
    fn: DuringFn,
    onComplete?: () => void,
    tag?: string,
  ): TimerHandle {
    const entry: DuringEntry = { kind: 'during', tag, time: 0, duration, fn, onComplete };
    return this.push(entry);
  }

  /** Cancel a single scheduled entry by its handle. Safe to call twice. */
  cancel(handle: TimerHandle): void {
    const i = this.entries.indexOf(handle);
    if (i !== -1) this.entries.splice(i, 1);
  }

  /** Cancel every entry started with the given tag. */
  cancelTag(tag: string): void {
    this.entries = this.entries.filter((e) => e.tag !== tag);
  }

  /** Cancel everything. */
  clear(): void {
    this.entries = [];
  }

  /** Number of live entries — handy for tests and debugging. */
  get size(): number {
    return this.entries.length;
  }

  /** Advance all timers by `dt` seconds. */
  update(dt: number): void {
    // Iterate over a snapshot: callbacks may schedule or cancel entries.
    const snapshot = this.entries.slice();
    for (const entry of snapshot) {
      if (!this.entries.includes(entry)) continue; // cancelled mid-update
      entry.time += dt;
      switch (entry.kind) {
        case 'after':
          if (entry.time >= entry.delay) {
            this.cancel(entry);
            entry.fn();
          }
          break;
        case 'every':
          while (entry.time >= entry.interval && entry.count > 0) {
            entry.time -= entry.interval;
            entry.count -= 1;
            entry.fn();
            if (entry.count <= 0) {
              this.cancel(entry);
              break;
            }
          }
          break;
        case 'tween': {
          const raw = entry.duration <= 0 ? 1 : entry.time / entry.duration;
          const clamped = raw < 0 ? 0 : raw > 1 ? 1 : raw;
          const eased = entry.easing(clamped);
          for (const key of entry.keys) {
            entry.target[key] = (entry.from[key] as number) + (entry.delta[key] as number) * eased;
          }
          if (clamped >= 1) {
            this.cancel(entry);
            entry.onComplete?.();
          }
          break;
        }
        case 'during':
          entry.fn(entry.time, dt);
          if (entry.time >= entry.duration) {
            this.cancel(entry);
            entry.onComplete?.();
          }
          break;
      }
    }
  }

  private push<T extends Entry>(entry: T): T {
    this.entries.push(entry);
    return entry;
  }
}
