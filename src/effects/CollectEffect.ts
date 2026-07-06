import { GameObject } from '../core/GameObject';
import { TWO_PI } from '../engine/mathutils';
import { Palette, type PaletteColor } from '../game/palette';

/** Seconds. */
const DURATION = 0.25;

const START_RADIUS = 4;
const END_RADIUS = 14;

export class CollectEffect extends GameObject {
  private readonly color: PaletteColor;
  private age = 0;

  constructor(x: number, y: number, color: PaletteColor = Palette.default) {
    super(x, y);
    this.color = color;
  }

  update(dt: number): void {
    this.age += dt;
    if (this.age >= DURATION) this.destroy();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const t = this.age / DURATION;
    const r = START_RADIUS + (END_RADIUS - START_RADIUS) * t;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, TWO_PI);
    ctx.stroke();
    ctx.restore();
  }
}
