import { GameObject } from '../../core/GameObject';
import { Timer } from '../../engine/timer';
import type { Input } from '../../engine/input';
import { Palette } from '../../game/palette';
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from '../../game/constants';
import { vectorFromAngle } from '../../engine/mathutils';
import {
  createBoostState,
  updateBoost,
  canBoost,
  BOOST_MAX,
  BOOST_REGEN_RATE,
  type BoostState,
} from './boost';
import {
  createHealthState,
  updateHealth,
  applyDamage,
  isInvulnerable,
  SHIP_MAX_HP,
  type HealthState,
} from './health';
import { TrailParticle } from './TrailParticle';

/** Public, read-only snapshot of the Boost meter for a future HUD. */
export interface BoostInfo {
  current: number;
  max: number;
  canBoost: boolean;
}

/** Public, read-only snapshot of the Ship's HP for the HUD. */
export interface HealthInfo {
  current: number;
  max: number;
  invulnerable: boolean;
}

// Motion tuning, tutorial-scale (the original also runs at 480x270).
const BASE_MAX_VELOCITY = 100; // px/s cruising speed
const ACCELERATION = 100; // px/s^2 toward the current max velocity
const TURN_RATE = 1.66 * Math.PI; // rad/s steering rate (v1 baseline)
const BOOST_MULTIPLIER = 1.5; // ArrowUp: faster
const BRAKE_MULTIPLIER = 0.5; // ArrowDown: slower
const COLLISION_RADIUS = 8;

/**
 * Per-Run Ship stats resolved from the Skill Tree modifiers by the Stage and
 * passed in as plain numbers (keeping the Ship free of any skilltree import).
 * Every field defaults to its v1 constant, so an omitted bag reproduces v1
 * behavior exactly.
 */
export interface ShipStats {
  /** Maximum HP and starting HP. */
  maxHp: number;
  /** Steering rate in rad/s. */
  turnRate: number;
  /** Boost meter ceiling and starting charge. */
  maxBoost: number;
  /** Boost regeneration rate per second while not boosting. */
  boostRegen: number;
}

/** v1-equivalent Ship stats (identity modifiers). */
export const DEFAULT_SHIP_STATS: ShipStats = {
  maxHp: SHIP_MAX_HP,
  turnRate: TURN_RATE,
  maxBoost: BOOST_MAX,
  boostRegen: BOOST_REGEN_RATE,
};

const TRAIL_INTERVAL = 0.01; // seconds between emitted particles
const TRAIL_RADIUS = 4; // starting radius of a trail particle
const TRAIL_LIFETIME = 0.15; // seconds a particle takes to shrink away

// Invulnerability blink: seconds per on/off cycle while invulnerable.
const BLINK_PERIOD = 0.1;

/**
 * The player-controlled Ship. Ported from the LÖVE tutorial's Player: it is in
 * constant forward motion along its `angle`, accelerating toward a max velocity
 * that boost/brake scale. The player only steers (left/right) and spends Boost
 * (up = faster, down = slower); the Ship never stops.
 *
 * Firing/Attacks are deliberately out of scope here — a separate AttackSystem
 * reads `x`, `y`, and `angle` (all public) to place shots. This class exposes
 * only position, heading, and a Boost snapshot; it never touches combat.
 */
export class Ship extends GameObject {
  /** Heading in radians (atan2 convention). Public so the AttackSystem can aim. */
  angle = -Math.PI / 2; // start pointing "up" the screen

  radius = COLLISION_RADIUS;

  private readonly input: Input;
  private readonly timer: Timer;
  /** True when the Ship created its own Timer (so it must advance it). */
  private readonly ownsTimer: boolean;
  private readonly turnRate: number;

  private velocity = 0;
  private readonly boostState: BoostState;
  private readonly healthState: HealthState;
  /** True on ticks where Boost was actually spent (drives visuals + trail color). */
  private boostingNow = false;
  /** Seconds the Ship has been alive; drives the invulnerability blink phase. */
  private aliveTime = 0;

  /**
   * @param timer  Optional external Timer to drive trail emission. If omitted the
   *               Ship owns one and advances it in `update`. If supplied (e.g. the
   *               room Timer), the caller is responsible for advancing it so it is
   *               not stepped twice per tick.
   */
  constructor(
    input: Input,
    x: number = PLAYFIELD_WIDTH / 2,
    y: number = PLAYFIELD_HEIGHT / 2,
    timer?: Timer,
    stats: ShipStats = DEFAULT_SHIP_STATS,
  ) {
    super(x, y);
    this.input = input;
    this.ownsTimer = timer === undefined;
    this.timer = timer ?? new Timer();
    this.turnRate = stats.turnRate;
    this.boostState = createBoostState(stats.maxBoost, stats.boostRegen);
    this.healthState = createHealthState(stats.maxHp);
    this.timer.every(TRAIL_INTERVAL, () => this.emitTrail(), Infinity, 'ship-trail');
  }

  get boost(): BoostInfo {
    return {
      current: this.boostState.current,
      max: this.boostState.max,
      canBoost: canBoost(this.boostState),
    };
  }

  get health(): HealthInfo {
    return {
      current: this.healthState.current,
      max: this.healthState.max,
      invulnerable: isInvulnerable(this.healthState),
    };
  }

  get hp(): number {
    return this.healthState.current;
  }

  get invulnerable(): boolean {
    return isInvulnerable(this.healthState);
  }

  addBoost(amount: number): void {
    this.boostState.current = Math.min(this.boostState.max, this.boostState.current + amount);
  }

  /**
   * Returns `true` iff this hit killed the Ship (HP reached 0 this call), so the
   * Stage can trigger the death beat exactly once.
   */
  takeDamage(amount: number): boolean {
    return applyDamage(this.healthState, amount);
  }

  update(dt: number): void {
    if (this.ownsTimer) this.timer.update(dt);
    this.aliveTime += dt;
    updateHealth(this.healthState, dt);
    this.steer(dt);
    this.applyBoost(dt);
    this.accelerate(dt);
    this.move(dt);
    this.wrap();
  }

  private steer(dt: number): void {
    if (this.input.isDown('ArrowLeft')) this.angle -= this.turnRate * dt;
    if (this.input.isDown('ArrowRight')) this.angle += this.turnRate * dt;
  }

  private applyBoost(dt: number): void {
    const requesting = this.input.anyDown('ArrowUp', 'ArrowDown');
    const spent = updateBoost(this.boostState, dt, requesting);
    this.boostingNow = spent;
  }

  private currentMaxVelocity(): number {
    if (!this.boostingNow) return BASE_MAX_VELOCITY;
    if (this.input.isDown('ArrowUp')) return BASE_MAX_VELOCITY * BOOST_MULTIPLIER;
    if (this.input.isDown('ArrowDown')) return BASE_MAX_VELOCITY * BRAKE_MULTIPLIER;

    return BASE_MAX_VELOCITY;
  }

  private accelerate(dt: number): void {
    const target = this.currentMaxVelocity();
    // Ease velocity toward the target so boost/brake feel smooth, not instant.
    if (this.velocity < target) {
      this.velocity = Math.min(target, this.velocity + ACCELERATION * dt);
    } else if (this.velocity > target) {
      this.velocity = Math.max(target, this.velocity - ACCELERATION * dt);
    }
  }

  private move(dt: number): void {
    const v = vectorFromAngle(this.angle, this.velocity * dt);
    this.x += v.x;
    this.y += v.y;
  }

  private wrap(): void {
    if (this.x < 0) this.x += PLAYFIELD_WIDTH;
    else if (this.x >= PLAYFIELD_WIDTH) this.x -= PLAYFIELD_WIDTH;
    if (this.y < 0) this.y += PLAYFIELD_HEIGHT;
    else if (this.y >= PLAYFIELD_HEIGHT) this.y -= PLAYFIELD_HEIGHT;
  }

  private emitTrail(): void {
    if (!this.area) return;
    const rear = vectorFromAngle(this.angle, -this.radius);
    const color = this.boostingNow ? Palette.boost : Palette.defaultDim;
    this.area.add(
      new TrailParticle(this.x + rear.x, this.y + rear.y, TRAIL_RADIUS, color, TRAIL_LIFETIME),
    );
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // While invulnerable, blink: skip drawing on alternate blink phases so the
    // Ship visibly flickers after taking a hit.
    if (this.invulnerable) {
      const phase = Math.floor(this.aliveTime / BLINK_PERIOD) % 2;
      if (phase === 0) return;
    }

    // Line-drawn triangular ship pointing along `angle`. Local coordinates are
    // in the Ship's frame (+x = forward), rotated into world space on draw.
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    ctx.strokeStyle = this.boostingNow ? Palette.boost : Palette.default;
    ctx.lineWidth = 1;

    const r = this.radius;
    ctx.beginPath();
    ctx.moveTo(r, 0); // nose
    ctx.lineTo(-r * 0.8, r * 0.7); // rear right
    ctx.lineTo(-r * 0.4, 0); // rear notch
    ctx.lineTo(-r * 0.8, -r * 0.7); // rear left
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  override destroy(): void {
    this.timer.cancelTag('ship-trail');
    super.destroy();
  }
}
