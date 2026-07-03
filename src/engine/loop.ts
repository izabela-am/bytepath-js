/**
 * Fixed-timestep game loop.
 *
 * Update runs at a fixed 60 Hz using an accumulator, so game logic is
 * deterministic and frame-rate independent. Render runs once per
 * requestAnimationFrame at whatever rate the display offers. If the tab is
 * backgrounded and a huge delta arrives, the accumulator is clamped to avoid a
 * "spiral of death" catch-up storm.
 */

export const FIXED_DT = 1 / 60;
const MAX_FRAME_DELTA = 0.25; // seconds; cap catch-up after a stall

export interface LoopCallbacks {
  /** Advance game state by a fixed `dt` (always FIXED_DT). */
  update(dt: number): void;
  /** Draw the current state. `alpha` is the 0..1 blend into the next tick. */
  render(alpha: number): void;
}

export class Loop {
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  private readonly callbacks: LoopCallbacks;

  constructor(callbacks: LoopCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private frame = (now: number): void => {
    if (!this.running) return;

    let frameDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (frameDelta > MAX_FRAME_DELTA) frameDelta = MAX_FRAME_DELTA;

    this.accumulator += frameDelta;
    while (this.accumulator >= FIXED_DT) {
      this.callbacks.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    const alpha = this.accumulator / FIXED_DT;
    this.callbacks.render(alpha);

    this.rafId = requestAnimationFrame(this.frame);
  };
}
