/**
 * Shared base for the geometric enemies the Director spawns into the Stage.
 * Ported in spirit from the LÖVE tutorial's enemy objects: each enemy is a
 * line-drawn shape in the HP hue that spawns just outside the playfield edge,
 * drifts in, and awards Score when destroyed.
 *
 * Concrete enemies (Rock, Shooter) supply their own movement and visual by
 * overriding `update`/`draw`; this base owns the health, damage, hit-flash, and
 * death bookkeeping that every enemy shares.
 *
 * Rendering rule (ADR 0001 / INTERFACES.md): only `draw(ctx)` touches the canvas
 * API. `takeDamage`/`update` stay canvas-free so the health rules are testable
 * without a DOM.
 */
import { GameObject } from '../core/GameObject';
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from '../game/constants';

/** Default hit points for an enemy — one Neutral hit-scale of damage each. */
export const ENEMY_DEFAULT_HP = 100;

/**
 * How long (seconds) an enemy renders in its flash color after taking a hit.
 * Purely visual; drives `draw` via `flashTimer` but never gameplay.
 */
export const ENEMY_HIT_FLASH_DURATION = 0.06;

/**
 * Extra margin (in playfield units) beyond an edge an enemy must reach before it
 * is culled for having drifted off-playfield. Keeps enemies from vanishing while
 * still partly visible, and gives them somewhere to spawn from.
 */
export const ENEMY_OFFSCREEN_MARGIN = 24;

export abstract class Enemy extends GameObject {
  hp: number;

  readonly scoreValue: number;

  /**
   * Seconds of hit-flash remaining. `draw` renders the flash color while this is
   * positive; `update` ticks it down. Subclasses should decrement it each tick
   * (via `tickFlash`) so the flash fades.
   */
  protected flashTimer = 0;

  constructor(x: number, y: number, scoreValue: number, hp: number = ENEMY_DEFAULT_HP) {
    super(x, y);
    this.hp = hp;
    this.scoreValue = scoreValue;
  }

  takeDamage(amount: number): void {
    if (this.dead) return;
    this.hp -= amount;
    this.flashTimer = ENEMY_HIT_FLASH_DURATION;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  get flashing(): boolean {
    return this.flashTimer > 0;
  }

  /**
   * Death hook. Override to spawn death particles / Ammo drops, then call
   * `super.die()`. Idempotent because `destroy()` is idempotent.
   */
  protected die(): void {
    this.destroy();
  }

  protected tickFlash(dt: number): void {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer < 0) this.flashTimer = 0;
    }
  }

  /**
   * Concrete enemies use this to self-destruct after crossing the playfield,
   * rather than piling up out of view.
   */
  protected isOffPlayfield(margin: number = ENEMY_OFFSCREEN_MARGIN): boolean {
    return (
      this.x < -margin ||
      this.x > PLAYFIELD_WIDTH + margin ||
      this.y < -margin ||
      this.y > PLAYFIELD_HEIGHT + margin
    );
  }
}

export type SpawnEdge = 'left' | 'right' | 'top' | 'bottom';

/**
 * `randRange(min, max)` must return a uniform float in [min, max); this keeps
 * spawn placement injectable/testable and independent of `Math.random`.
 */
export function spawnPointOnEdge(
  edge: SpawnEdge,
  randRange: (min: number, max: number) => number,
  spawnMargin: number = ENEMY_OFFSCREEN_MARGIN,
): { x: number; y: number } {
  switch (edge) {
    case 'left':
      return { x: -spawnMargin, y: randRange(0, PLAYFIELD_HEIGHT) };
    case 'right':
      return { x: PLAYFIELD_WIDTH + spawnMargin, y: randRange(0, PLAYFIELD_HEIGHT) };
    case 'top':
      return { x: randRange(0, PLAYFIELD_WIDTH), y: -spawnMargin };
    case 'bottom':
      return { x: randRange(0, PLAYFIELD_WIDTH), y: PLAYFIELD_HEIGHT + spawnMargin };
  }
}
