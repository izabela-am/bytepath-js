/**
 * Base for the collectible Pickups the Director drops into play (CONTEXT.md:
 * Ammo / Boost / Attack pickups). A Pickup spawns at a point, drifts slowly in a
 * random direction, and is collected when the Ship overlaps it — the collect
 * *response* (applying the effect, awarding Score, spawning a CollectEffect,
 * playing a sound) lives in the Stage, matching the Area contract where objects
 * report overlaps and rooms resolve them.
 *
 * Rendering rule (ADR 0001): only `draw` touches the canvas.
 */
import { GameObject } from '../core/GameObject';
import { TWO_PI, randomRange, vectorFromAngle } from '../engine/mathutils';
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from '../game/constants';
import type { PaletteColor } from '../game/palette';
import type { PickupKind } from '../score/Score';

/** Collision radius shared by all Pickups (a comfortable pickup range). */
export const PICKUP_RADIUS = 7;

/** Slow drift speed range, px/s. */
const DRIFT_MIN_SPEED = 8;
const DRIFT_MAX_SPEED = 20;

/** Margin past the edge before an uncollected Pickup is culled. */
const OFFSCREEN_MARGIN = 16;

export abstract class Pickup extends GameObject {
  abstract readonly kind: PickupKind;
  /** Resource color for the glyph and the collect effect. */
  abstract readonly color: PaletteColor;

  private readonly vx: number;
  private readonly vy: number;
  /** Rotation used to give the glyph a slow idle spin. */
  protected spin = 0;

  constructor(x: number, y: number) {
    super(x, y);
    this.radius = PICKUP_RADIUS;
    const heading = randomRange(0, TWO_PI);
    const speed = randomRange(DRIFT_MIN_SPEED, DRIFT_MAX_SPEED);
    const v = vectorFromAngle(heading, speed);
    this.vx = v.x;
    this.vy = v.y;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.spin += dt;
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
    ctx.rotate(this.spin);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    this.drawGlyph(ctx);
    ctx.restore();
  }

  /** Draw the pickup's shape in local (translated, rotated) space. */
  protected abstract drawGlyph(ctx: CanvasRenderingContext2D): void;
}
