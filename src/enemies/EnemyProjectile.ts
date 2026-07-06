/**
 * Collision *response* (applying `damage` to the Ship) is the Stage/integrator's
 * job — this object only exposes `damage` and its collision circle, matching the
 * Area contract where objects report overlaps and rooms resolve them.
 */
import { GameObject } from '../core/GameObject';
import { Palette } from '../game/palette';
import { vectorFromAngle } from '../engine/mathutils';
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from '../game/constants';

/** Travel speed range, playfield units per second. */
export const ENEMY_PROJECTILE_MIN_SPEED = 100;
export const ENEMY_PROJECTILE_MAX_SPEED = 140;

export const ENEMY_PROJECTILE_RADIUS = 2;

export const ENEMY_PROJECTILE_DAMAGE = 10;

/** Margin past which the projectile is culled for leaving the playfield. */
const OFFSCREEN_MARGIN = 8;

const PROJECTILE_LENGTH = 6;

export class EnemyProjectile extends GameObject {
  readonly damage: number;

  private readonly vx: number;
  private readonly vy: number;
  private readonly heading: number;

  /** `heading` is the travel direction in radians (atan2 convention). */
  constructor(
    x: number,
    y: number,
    heading: number,
    speed: number = (ENEMY_PROJECTILE_MIN_SPEED + ENEMY_PROJECTILE_MAX_SPEED) / 2,
    damage: number = ENEMY_PROJECTILE_DAMAGE,
  ) {
    super(x, y);
    this.radius = ENEMY_PROJECTILE_RADIUS;
    this.damage = damage;
    this.heading = heading;
    const v = vectorFromAngle(heading, speed);
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
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.heading);
    ctx.strokeStyle = Palette.hp;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-PROJECTILE_LENGTH / 2, 0);
    ctx.lineTo(PROJECTILE_LENGTH / 2, 0);
    ctx.stroke();
    ctx.restore();
  }
}
