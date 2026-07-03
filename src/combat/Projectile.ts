/**
 * A projectile fired by an Attack. Moves in a straight line at a constant speed
 * along its heading and dies when it leaves the playfield. Ported from the
 * tutorial's Projectile: a small line drawn in the Attack's color.
 *
 * Collision response (dealing `damage` to enemies) lives with whoever runs the
 * overlap query — the Area only reports overlaps (see INTERFACES.md). This class
 * just exposes `damage` and `radius`.
 */
import { GameObject } from '../core/GameObject';
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from '../game/constants';
import { vectorFromAngle } from '../engine/mathutils';
import { Palette, type PaletteColor } from '../game/palette';

/** Constant travel speed for every projectile, in px/s. */
export const PROJECTILE_SPEED = 200;

/** Collision circle radius shared by all projectiles. */
export const PROJECTILE_RADIUS = 2.5;

/** Default damage dealt on hit. */
export const PROJECTILE_DAMAGE = 100;

/** Margin (px) past the playfield edge before a projectile is culled. */
const OFFSCREEN_MARGIN = 8;

export interface ProjectileOptions {
  /** Heading in radians (atan2 convention). */
  angle: number;
  /** Color to draw in. Defaults to the neutral geometry color. */
  color?: PaletteColor;
  /** Damage dealt on hit. Defaults to PROJECTILE_DAMAGE. */
  damage?: number;
  /** Travel speed in px/s. Defaults to PROJECTILE_SPEED. */
  speed?: number;
}

export class Projectile extends GameObject {
  readonly angle: number;
  readonly color: PaletteColor;
  damage: number;

  private readonly vx: number;
  private readonly vy: number;

  constructor(x: number, y: number, options: ProjectileOptions) {
    super(x, y);
    this.angle = options.angle;
    this.color = options.color ?? Palette.default;
    this.damage = options.damage ?? PROJECTILE_DAMAGE;
    this.radius = PROJECTILE_RADIUS;

    const v = vectorFromAngle(this.angle, options.speed ?? PROJECTILE_SPEED);
    this.vx = v.x;
    this.vy = v.y;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (
      this.x < -OFFSCREEN_MARGIN ||
      this.x > PLAYFIELD_WIDTH + OFFSCREEN_MARGIN ||
      this.y < -OFFSCREEN_MARGIN ||
      this.y > PLAYFIELD_HEIGHT + OFFSCREEN_MARGIN
    ) {
      this.destroy();
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // A short line segment oriented along the heading, tutorial-style.
    const half = 4;
    const dir = vectorFromAngle(this.angle, half);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x - dir.x, this.y - dir.y);
    ctx.lineTo(this.x + dir.x, this.y + dir.y);
    ctx.stroke();
  }
}
