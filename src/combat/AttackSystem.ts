/**
 * Canvas-free orchestrator for the Ship's firing. Owns the current Attack and
 * the Ammo pool, auto-fires on the Attack's cadence, spends Ammo per trigger,
 * and reverts to Neutral when Ammo runs short (CONTEXT.md: "Running out forces
 * the Attack back to Neutral").
 *
 * The integrator constructs one of these with the Stage's Area and Timer and
 * calls `update(dt, source)` each tick with the Ship's position and heading.
 * Projectiles and ShootEffects are added into the Area; the AttackSystem itself
 * is not a GameObject and never touches the canvas.
 */
import type { Area } from '../core/Area';
import type { Timer } from '../engine/timer';
import { clamp, randomRange, vectorFromAngle } from '../engine/mathutils';
import {
  ATTACKS,
  NEUTRAL_ATTACK,
  type Attack,
  type AttackName,
} from './attacks';
import { Projectile } from './Projectile';
import { ShootEffect } from './ShootEffect';

/** Maximum Ammo the pool can hold; also the starting value. */
export const MAX_AMMO = 100;

/** Distance (px) in front of the source that projectiles spawn from. */
export const MUZZLE_OFFSET = 12;

/** Position and heading of whatever is firing (the Ship). */
export interface FireSource {
  x: number;
  y: number;
  /** Heading in radians (atan2 convention). */
  angle: number;
}

export class AttackSystem {
  private readonly area: Area;
  private readonly timer: Timer;

  private attack: Attack = NEUTRAL_ATTACK;
  private ammoValue = MAX_AMMO;

  /** Seconds until the next automatic trigger. */
  private cycle = 0;

  constructor(area: Area, timer: Timer) {
    this.area = area;
    this.timer = timer;
    this.cycle = this.attack.fireInterval;
  }

  /** The current Attack (starts Neutral). */
  get currentAttack(): Attack {
    return this.attack;
  }

  /** Convenience accessor for the current Attack's name. */
  get currentAttackName(): AttackName {
    return this.attack.name;
  }

  /** Current Ammo (0..MAX_AMMO). */
  get ammo(): number {
    return this.ammoValue;
  }

  /** Maximum Ammo, exposed for the HUD. */
  get maxAmmo(): number {
    return MAX_AMMO;
  }

  /**
   * Advance the firing cadence. When the cycle elapses, fire from a muzzle in
   * front of `source`, spending the Attack's Ammo cost. If Ammo is insufficient
   * for the shot, revert to Neutral and fire that (free) shot instead.
   */
  update(dt: number, source: FireSource): void {
    this.cycle -= dt;
    // Catch up on any triggers owed within this dt (mirrors Timer.every).
    while (this.cycle <= 0) {
      this.fire(source);
      this.cycle += this.attack.fireInterval;
    }
  }

  /**
   * Replace the current Attack (Attack pickups call this) and reset the cycle so
   * the new Attack's cadence starts cleanly.
   */
  setAttack(name: AttackName): void {
    this.attack = ATTACKS[name];
    this.cycle = this.attack.fireInterval;
  }

  /** Add Ammo, clamped to [0, MAX_AMMO]. Ammo pickups call this. */
  addAmmo(n: number): void {
    this.ammoValue = clamp(this.ammoValue + n, 0, MAX_AMMO);
  }

  private fire(source: FireSource): void {
    // Not enough Ammo for this Attack: revert to Neutral (free) and fire that.
    if (this.ammoValue < this.attack.ammoCost) {
      this.attack = NEUTRAL_ATTACK;
    }

    this.ammoValue = clamp(this.ammoValue - this.attack.ammoCost, 0, MAX_AMMO);

    const muzzle = vectorFromAngle(source.angle, MUZZLE_OFFSET);
    const mx = source.x + muzzle.x;
    const my = source.y + muzzle.y;

    for (const shot of this.attack.spawn.shots) {
      let angle = source.angle + shot.angleOffset;
      if (shot.randomSpreadHalfAngle) {
        angle += randomRange(-shot.randomSpreadHalfAngle, shot.randomSpreadHalfAngle);
      }
      this.area.add(new Projectile(mx, my, { angle, color: this.attack.color }));
    }

    this.area.add(new ShootEffect(mx, my, this.timer, this.attack.color));
  }
}
