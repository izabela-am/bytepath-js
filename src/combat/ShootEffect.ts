/**
 * A brief square flash at the muzzle when the Ship fires. Purely cosmetic;
 * ported from the tutorial's ShootEffect. Shrinks to nothing via a Timer tween
 * and then removes itself.
 *
 * The effect is driven by an externally owned Timer (the Room's), passed in at
 * construction, so it advances on the same fixed dt as everything else.
 */
import { GameObject } from '../core/GameObject';
import { Timer, Easing } from '../engine/timer';
import { Palette, type PaletteColor } from '../game/palette';

/** Starting half-size (px) of the flash square. */
const START_SIZE = 6;

/** How long the flash takes to shrink away, in seconds. */
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

    // Shrink to zero, then die. Tagged so a caller could cancel a batch.
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
