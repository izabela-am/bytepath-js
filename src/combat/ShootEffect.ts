/**
 * The effect is driven by an externally owned Timer (the Room's), passed in at
 * construction, so it advances on the same fixed dt as everything else.
 */
import { GameObject } from '../core/GameObject';
import { Timer, Easing } from '../engine/timer';
import { Palette, type PaletteColor } from '../game/palette';

/** Half-size (px) of the flash square. */
const START_SIZE = 6;

/** Seconds. */
const DURATION = 0.12;

export class ShootEffect extends GameObject {
  private readonly timer: Timer;
  private readonly color: PaletteColor;

  // Plain object so Timer.tween (which needs a Record<string, number> target)
  // can mutate `size` in place; draw() reads it each frame.
  private readonly state = { size: START_SIZE };

  constructor(x: number, y: number, timer: Timer, color: PaletteColor = Palette.default) {
    super(x, y);
    this.timer = timer;
    this.color = color;

    // Tagged so a caller could cancel a batch.
    this.timer.tween(
      DURATION,
      this.state,
      { size: 0 },
      Easing.linear,
      () => this.destroy(),
      'shoot-effect',
    );
  }

  // The tween mutates `state.size` directly; nothing else to do per tick.
  update(_dt: number): void {}

  draw(ctx: CanvasRenderingContext2D): void {
    const s = this.state.size;
    if (s <= 0) return;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - s, this.y - s, s * 2, s * 2);
  }
}
