import { GameObject } from '../../core/GameObject';
import { Timer } from '../../engine/timer';
import type { PaletteColor } from '../../game/palette';

/**
 * Color is fixed at spawn (Palette.boost while boosting, Palette.defaultDim
 * otherwise) so a boost burst reads as a colored streak trailing the Ship.
 *
 * The particle owns a small Timer so it is self-contained: the Ship (or Room)
 * only has to `area.add(new TrailParticle(...))` and forget about it. Not
 * collidable (radius on GameObject stays 0); `r` below is a pure visual radius.
 */
export class TrailParticle extends GameObject {
  private readonly timer = new Timer();

  /**
   * Visual radius, tweened to 0 over the lifetime. Held in a plain object (not
   * on `this`) because Timer.tween mutates a `Record<string, number>`.
   */
  private readonly visual: { r: number };

  private readonly color: PaletteColor;

  constructor(x: number, y: number, radius: number, color: PaletteColor, lifetime: number) {
    super(x, y);
    this.visual = { r: radius };
    this.color = color;
    // Tag so destroy() can cancel cleanly.
    this.timer.tween(
      lifetime,
      this.visual,
      { r: 0 },
      undefined,
      () => this.destroy(),
      'trail',
    );
  }

  update(dt: number): void {
    this.timer.update(dt);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.visual.r <= 0) return;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.visual.r, 0, Math.PI * 2);
    ctx.fill();
  }

  override destroy(): void {
    this.timer.cancelTag('trail');
    super.destroy();
  }
}
