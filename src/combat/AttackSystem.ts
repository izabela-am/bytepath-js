/**
 * Reverts to Neutral when Ammo runs short (CONTEXT.md: "Running out forces the
 * Attack back to Neutral").
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
import { Projectile, PROJECTILE_SPEED, PROJECTILE_DAMAGE } from './Projectile';
import { ShootEffect } from './ShootEffect';

/** Maximum Ammo the pool can hold; also the starting value. */
export const MAX_AMMO = 100;

/** Distance (px) in front of the source that projectiles spawn from. */
export const MUZZLE_OFFSET = 12;

export interface FireSource {
  x: number;
  y: number;
  /** Heading in radians (atan2 convention). */
  angle: number;
}

/**
 * Per-Run firing stats, resolved from the Skill Tree modifiers by the Stage and
 * passed in as plain numbers (keeping this module free of any skilltree import).
 * Every field defaults to its v1 constant, so an omitted bag — or one built from
 * identity modifiers — reproduces v1 firing exactly.
 */
export interface AttackStats {
  /** Maximum Ammo pool size and starting Ammo. */
  maxAmmo: number;
  /** In px/s. */
  projectileSpeed: number;
  projectileDamage: number;
  /**
   * Shots-per-second multiplier. The Attack's base `fireInterval` is divided by
   * this, so `fireRate = 2` fires twice as often. Identity is 1.
   */
  fireRate: number;
}

/** v1-equivalent firing stats (identity modifiers). */
export const DEFAULT_ATTACK_STATS: AttackStats = {
  maxAmmo: MAX_AMMO,
  projectileSpeed: PROJECTILE_SPEED,
  projectileDamage: PROJECTILE_DAMAGE,
  fireRate: 1,
};

export class AttackSystem {
  private readonly area: Area;
  private readonly timer: Timer;
  private readonly stats: AttackStats;

  private attack: Attack = NEUTRAL_ATTACK;
  private ammoValue: number;

  /** Seconds until the next automatic trigger. */
  private cycle = 0;

  constructor(area: Area, timer: Timer, stats: AttackStats = DEFAULT_ATTACK_STATS) {
    this.area = area;
    this.timer = timer;
    this.stats = stats;
    this.ammoValue = stats.maxAmmo;
    this.cycle = this.fireInterval();
  }

  private fireInterval(): number {
    return this.attack.fireInterval / this.stats.fireRate;
  }

  get currentAttack(): Attack {
    return this.attack;
  }

  get currentAttackName(): AttackName {
    return this.attack.name;
  }

  get ammo(): number {
    return this.ammoValue;
  }

  /** Maximum Ammo, exposed for the HUD. */
  get maxAmmo(): number {
    return this.stats.maxAmmo;
  }

  update(dt: number, source: FireSource): void {
    this.cycle -= dt;
    // Catch up on any triggers owed within this dt (mirrors Timer.every).
    while (this.cycle <= 0) {
      this.fire(source);
      this.cycle += this.fireInterval();
    }
  }

  /** Resets the cycle so the new Attack's cadence starts cleanly. */
  setAttack(name: AttackName): void {
    this.attack = ATTACKS[name];
    this.cycle = this.fireInterval();
  }

  addAmmo(n: number): void {
    this.ammoValue = clamp(this.ammoValue + n, 0, this.stats.maxAmmo);
  }

  private fire(source: FireSource): void {
    // Not enough Ammo for this Attack: revert to Neutral (free) and fire that.
    if (this.ammoValue < this.attack.ammoCost) {
      this.attack = NEUTRAL_ATTACK;
    }

    this.ammoValue = clamp(this.ammoValue - this.attack.ammoCost, 0, this.stats.maxAmmo);

    const muzzle = vectorFromAngle(source.angle, MUZZLE_OFFSET);
    const mx = source.x + muzzle.x;
    const my = source.y + muzzle.y;

    for (const shot of this.attack.spawn.shots) {
      let angle = source.angle + shot.angleOffset;
      if (shot.randomSpreadHalfAngle) {
        angle += randomRange(-shot.randomSpreadHalfAngle, shot.randomSpreadHalfAngle);
      }
      this.area.add(
        new Projectile(mx, my, {
          angle,
          color: this.attack.color,
          speed: this.stats.projectileSpeed,
          damage: this.stats.projectileDamage,
        }),
      );
    }

    this.area.add(new ShootEffect(mx, my, this.timer, this.attack.color));
  }
}
