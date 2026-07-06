/**
 * Abstract base for everything that lives in an Area: the Ship, Attacks,
 * enemies, Pickups, particles. Ported from the LÖVE tutorial's GameObject.
 *
 * Contract:
 *  - Objects hold their own position and update themselves via `update(dt)`.
 *  - `draw(ctx)` is the ONLY place an object may touch the canvas API. Game
 *    logic must never render directly (keeps the render layer swappable).
 *  - Set `dead = true` (or call `destroy()`) to mark an object for removal; the
 *    owning Area culls dead objects on its next update.
 *  - `radius` (when > 0) is the collision circle used by Area's overlap queries.
 */
export abstract class GameObject {
  x: number;
  y: number;

  /** Collision circle radius. 0 (default) means "not collidable". */
  radius = 0;

  dead = false;

  /** Set by Area.add. */
  area: import('./Area').Area | null = null;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  abstract update(dt: number): void;

  abstract draw(ctx: CanvasRenderingContext2D): void;

  /**
   * Override to release timers or child objects, then call `super.destroy()`.
   * Idempotent.
   */
  destroy(): void {
    this.dead = true;
  }
}
