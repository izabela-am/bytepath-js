/**
 * Between shots the Shooter briefly flashes a pre-fire telegraph so the player
 * can read the incoming shot, then spawns the projectile aimed at the target's
 * position at fire time.
 *
 * The target is injected as a `getTarget` callback so this file stays decoupled
 * from the Ship: the integrator passes `() => ship` (or `null` when there's no
 * live Ship). If the target is null at fire time, the Shooter holds fire.
 */
import { Enemy } from './Enemy';
import { spawnPointOnEdge, type SpawnEdge } from './Enemy';
import {
  EnemyProjectile,
  ENEMY_PROJECTILE_MIN_SPEED,
  ENEMY_PROJECTILE_MAX_SPEED,
} from './EnemyProjectile';
import { Palette } from '../game/palette';
import { Timer } from '../engine/timer';
import { randomRange, randomChoice, angle as angleBetween } from '../engine/mathutils';
import { PLAYFIELD_HEIGHT } from '../game/constants';

export const SHOOTER_HP = 100;
export const SHOOTER_SCORE = 150;
export const SHOOTER_RADIUS = 8;

/** Slow horizontal-ish drift speed range, playfield units per second. */
export const SHOOTER_MIN_SPEED = 10;
export const SHOOTER_MAX_SPEED = 30;

/** Time between shots (seconds), chosen randomly per shot in this range. */
export const SHOOTER_MIN_FIRE_INTERVAL = 1.5;
export const SHOOTER_MAX_FIRE_INTERVAL = 2.5;

/** Seconds. */
export const SHOOTER_TELEGRAPH_DURATION = 0.25;

export type TargetPoint = { x: number; y: number } | null;

export class Shooter extends Enemy {
  private vx: number;
  private vy: number;
  private readonly timer = new Timer();
  private readonly getTarget: () => TargetPoint;

  private telegraphing = false;

  constructor(getTarget: () => TargetPoint) {
    const edge = randomChoice<SpawnEdge>(['left', 'right']);
    const { x, y } = spawnPointOnEdge(edge, randomRange);
    super(x, y, SHOOTER_SCORE, SHOOTER_HP);
    this.radius = SHOOTER_RADIUS;
    this.getTarget = getTarget;

    const dir = edge === 'left' ? 1 : -1;
    const speed = randomRange(SHOOTER_MIN_SPEED, SHOOTER_MAX_SPEED);
    // Mostly horizontal, with a gentle vertical component for variety.
    this.vx = dir * speed;
    this.vy = randomRange(-0.35, 0.35) * speed;

    this.scheduleNextShot();
  }

  private scheduleNextShot(): void {
    const delay = randomRange(SHOOTER_MIN_FIRE_INTERVAL, SHOOTER_MAX_FIRE_INTERVAL);
    this.timer.after(delay, () => this.beginFire(), 'fire');
  }

  private beginFire(): void {
    this.telegraphing = true;
    this.timer.after(
      SHOOTER_TELEGRAPH_DURATION,
      () => {
        this.telegraphing = false;
        this.fire();
        this.scheduleNextShot();
      },
      'fire',
    );
  }

  private fire(): void {
    if (this.dead || !this.area) return;
    const target = this.getTarget();
    if (!target) return;
    const heading = angleBetween(this.x, this.y, target.x, target.y);
    const speed = randomRange(ENEMY_PROJECTILE_MIN_SPEED, ENEMY_PROJECTILE_MAX_SPEED);
    const projectile = new EnemyProjectile(this.x, this.y, heading, speed);
    this.area.add(projectile);
  }

  update(dt: number): void {
    this.tickFlash(dt);
    this.timer.update(dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // Bounce gently off the top/bottom so a Shooter stays on-playfield long
    // enough to be a threat, rather than drifting straight out vertically.
    if (this.y < 0 || this.y > PLAYFIELD_HEIGHT) this.vy = -this.vy;
    if (this.isOffPlayfield()) this.destroy();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    const target = this.getTarget();
    if (target) ctx.rotate(angleBetween(this.x, this.y, target.x, target.y));
    ctx.strokeStyle = this.flashing || this.telegraphing ? Palette.negative : Palette.hp;
    ctx.lineWidth = 1;
    const r = this.radius;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.7, r * 0.7);
    ctx.lineTo(-r * 0.3, 0);
    ctx.lineTo(-r * 0.7, -r * 0.7);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  protected override die(): void {
    this.timer.cancelTag('fire');
    super.die();
  }

  override destroy(): void {
    this.timer.clear();
    super.destroy();
  }
}
