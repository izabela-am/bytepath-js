/**
 * A small geometric explosion: a burst of short line shards flung outward from a
 * point, fading as they fly. Ported in spirit from the tutorial's line-based
 * explosion particles. Used on enemy death and, larger, on Ship death.
 *
 * Purely cosmetic. Advances on the fixed dt like everything else; removes itself
 * once every shard has faded. Only `draw` touches the canvas.
 */
import { GameObject } from '../core/GameObject';
import { TWO_PI, randomRange, vectorFromAngle } from '../engine/mathutils';
import { Palette, type PaletteColor } from '../game/palette';

interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Rendered length of the shard. */
  length: number;
  angle: number;
}

export interface ExplosionOptions {
  /** Number of line shards. */
  count?: number;
  /** Shard color. Defaults to the neutral geometry color. */
  color?: PaletteColor;
  /** Speed range for shards, px/s. */
  minSpeed?: number;
  maxSpeed?: number;
  /** Seconds the explosion takes to fully fade. */
  lifetime?: number;
}

const DEFAULTS = {
  count: 8,
  minSpeed: 60,
  maxSpeed: 160,
  lifetime: 0.4,
} as const;

export class Explosion extends GameObject {
  private readonly shards: Shard[];
  private readonly color: PaletteColor;
  private readonly lifetime: number;
  private age = 0;

  constructor(x: number, y: number, options: ExplosionOptions = {}) {
    super(x, y);
    this.color = options.color ?? Palette.default;
    this.lifetime = options.lifetime ?? DEFAULTS.lifetime;
    const count = options.count ?? DEFAULTS.count;
    const minSpeed = options.minSpeed ?? DEFAULTS.minSpeed;
    const maxSpeed = options.maxSpeed ?? DEFAULTS.maxSpeed;

    this.shards = Array.from({ length: count }, () => {
      const a = randomRange(0, TWO_PI);
      const speed = randomRange(minSpeed, maxSpeed);
      const v = vectorFromAngle(a, speed);
      return {
        x,
        y,
        vx: v.x,
        vy: v.y,
        length: randomRange(3, 6),
        angle: a,
      };
    });
  }

  update(dt: number): void {
    this.age += dt;
    if (this.age >= this.lifetime) {
      this.destroy();
      return;
    }
    for (const s of this.shards) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      // Ease shards to a stop so the burst decelerates as it fades.
      s.vx *= 0.92;
      s.vy *= 0.92;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const alpha = 1 - this.age / this.lifetime;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    for (const s of this.shards) {
      const dir = vectorFromAngle(s.angle, s.length / 2);
      ctx.beginPath();
      ctx.moveTo(s.x - dir.x, s.y - dir.y);
      ctx.lineTo(s.x + dir.x, s.y + dir.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}
