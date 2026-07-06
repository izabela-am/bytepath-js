import { Area } from '../core/Area';
import type { Room } from '../core/Room';
import { Timer } from '../engine/timer';
import type { Input } from '../engine/input';
import { Palette } from '../game/palette';
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from '../game/constants';
import { Ship } from '../objects/ship/Ship';
import { AttackSystem } from '../combat/AttackSystem';
import { Projectile } from '../combat/Projectile';
import { PROJECTILE_SPEED, PROJECTILE_DAMAGE } from '../combat/Projectile';
import { MAX_AMMO } from '../combat/AttackSystem';
import { Director, type EnemyName, type ResourceName } from '../director/Director';
import { Enemy } from '../enemies/Enemy';
import { Rock } from '../enemies/Rock';
import { Shooter } from '../enemies/Shooter';
import { EnemyProjectile } from '../enemies/EnemyProjectile';
import { Pickup } from '../pickups/Pickup';
import { AmmoPickup } from '../pickups/AmmoPickup';
import { BoostPickup } from '../pickups/BoostPickup';
import { AttackPickup } from '../pickups/AttackPickup';
import { SpPickup } from '../pickups/SpPickup';
import {
  applyAttackPickup,
  AMMO_PICKUP_AMOUNT,
  BOOST_PICKUP_AMOUNT,
  SP_PICKUP_BASE_VALUE,
  resolveSpPickupValue,
} from '../pickups/pickupEffects';
import { SHIP_MAX_HP } from '../objects/ship/health';
import { BOOST_MAX, BOOST_REGEN_RATE } from '../objects/ship/boost';
import { Explosion } from '../effects/Explosion';
import { CollectEffect } from '../effects/CollectEffect';
import { Score } from '../score/Score';
import { RunState } from '../runstate/RunState';
import { Hud } from '../hud/Hud';
import type { Sfx } from '../audio/Sfx';
import { randomRange } from '../engine/mathutils';
import {
  IDENTITY_MODIFIERS,
  applyModifier,
  type RunModifiers,
} from '../skilltree/modifiers';

const ENEMY_CONTACT_DAMAGE = 30;

/** Base chance an enemy drops an Ammo pickup on death (before `ammoDropChance`). */
const AMMO_DROP_CHANCE = 0.2;

/** The Ship's v1 baseline steering rate (rad/s); the `turnRate` modifier base. */
const SHIP_BASE_TURN_RATE = 1.66 * Math.PI;

/** The v1 baseline fire-rate multiplier; the `fireRate` modifier base. */
const BASE_FIRE_RATE = 1;

/**
 * The gameplay Room and the seam where every slice meets. It owns the Area that
 * all gameplay GameObjects register into (Ship, Projectiles, enemies, Pickups,
 * effects), a Timer for room-scoped scheduling, the AttackSystem that fires from
 * the Ship, the Director that escalates spawns, the Score, and the RunState that
 * sequences death and restart.
 *
 * The Area only reports overlaps (INTERFACES.md); all collision *response* lives
 * here: Ship-Projectile vs enemy, enemy/EnemyProjectile vs Ship, and Ship vs
 * Pickup. When the Ship dies, the Stage plays a brief death beat and then calls
 * `onRestart` with the final Score so the caller can swap in a fresh Stage.
 */
export class Stage implements Room {
  readonly area = new Area();
  readonly timer = new Timer();
  readonly ship: Ship;

  private readonly input: Input;
  private readonly attacks: AttackSystem;
  private readonly director: Director;
  private readonly score: Score;
  private readonly runState: RunState;
  private readonly hud = new Hud();
  private readonly sfx: Sfx | null;
  private readonly onRestart: (finalScore: number, spEarned: number) => void;

  /** Skill Tree modifiers snapshotted at launch (ADR 0002); read once here. */
  private readonly modifiers: RunModifiers;
  /** Resolved Ammo granted per Ammo pickup (base * `ammoPickupAmount`). */
  private readonly ammoPickupAmount: number;
  /** Resolved Boost granted per Boost pickup (base * `boostPickupAmount`). */
  private readonly boostPickupAmount: number;
  /** Resolved enemy Ammo-drop chance (base 0.2 * `ammoDropChance`). */
  private readonly ammoDropChance: number;
  /** Resolved SP banked per SP pickup (integer, floored ≥ 0). */
  private readonly spPickupValue: number;
  private spCollected = 0;

  /**
   * @param input       Shared keyboard tracker.
   * @param options.sfx Shared Sfx instance (audio persists across Runs). Optional.
   * @param options.lastRunScore Previous Run's Score, shown briefly on the HUD.
   * @param options.onRestart Called with the final Score and the SP earned this
   *                          Run when the death beat ends, so the caller can swap
   *                          in a fresh Stage and bank the SP.
   * @param options.runModifiers Skill Tree modifiers to apply for this Run.
   *                          Defaults to identity (fresh save => exact v1
   *                          behavior). Snapshotted at construction (ADR 0002).
   */
  constructor(
    input: Input,
    options: {
      sfx?: Sfx | null;
      lastRunScore?: number | null;
      onRestart?: (finalScore: number, spEarned: number) => void;
      runModifiers?: RunModifiers;
    } = {},
  ) {
    this.input = input;
    this.sfx = options.sfx ?? null;
    this.onRestart = options.onRestart ?? (() => {});
    this.runState = new RunState(options.lastRunScore ?? null);
    this.modifiers = options.runModifiers ?? IDENTITY_MODIFIERS;

    // Resolve every stat once, up front, into plain numbers. The pure modules
    // (Ship, AttackSystem, Score) receive these numbers and never import the
    // Skill Tree — coupling stays one-directional (rooms depend on skilltree).
    const m = this.modifiers;
    this.ammoPickupAmount = applyModifier(AMMO_PICKUP_AMOUNT, m.ammoPickupAmount);
    this.boostPickupAmount = applyModifier(BOOST_PICKUP_AMOUNT, m.boostPickupAmount);
    this.ammoDropChance = applyModifier(AMMO_DROP_CHANCE, m.ammoDropChance);
    this.spPickupValue = resolveSpPickupValue(applyModifier(SP_PICKUP_BASE_VALUE, m.spPickupValue));

    this.score = new Score(applyModifier(1, m.scoreMultiplier));

    this.ship = this.area.add(
      new Ship(this.input, PLAYFIELD_WIDTH / 2, PLAYFIELD_HEIGHT / 2, this.timer, {
        maxHp: applyModifier(SHIP_MAX_HP, m.maxHp),
        turnRate: applyModifier(SHIP_BASE_TURN_RATE, m.turnRate),
        maxBoost: applyModifier(BOOST_MAX, m.maxBoost),
        boostRegen: applyModifier(BOOST_REGEN_RATE, m.boostRegen),
      }),
    );

    // The AttackSystem fires from the Ship each tick; its Projectiles and shoot
    // effects register into this Area and draw in the current Attack's color.
    this.attacks = new AttackSystem(this.area, this.timer, {
      maxAmmo: applyModifier(MAX_AMMO, m.maxAmmo),
      projectileSpeed: applyModifier(PROJECTILE_SPEED, m.projectileSpeed),
      projectileDamage: applyModifier(PROJECTILE_DAMAGE, m.projectileDamage),
      fireRate: applyModifier(BASE_FIRE_RATE, m.fireRate),
    });

    // The Director drives spawns via callbacks; it holds no GameObject refs.
    this.director = new Director({
      spawnEnemy: (name) => this.spawnEnemy(name),
      spawnResource: (name) => this.spawnResource(name),
    });
  }

  get currentScore(): number {
    return this.score.value;
  }

  /** SP collected this Run so far (banked in full when the Run ends). */
  get spEarned(): number {
    return this.spCollected;
  }

  /** Whether the Run is still being played (Ship alive, not in the death beat). */
  get isRunActive(): boolean {
    return this.runState.isPlaying;
  }

  update(dt: number): void {
    this.timer.update(dt);
    this.runState.update(dt);

    if (this.runState.isPlaying) {
      // Survival Score and escalation only accrue while the Ship is alive.
      this.score.addSurvival(dt);
      this.director.update(dt);
      this.attacks.update(dt, this.ship);
    }

    this.area.update(dt);

    if (this.runState.isPlaying) {
      this.resolveCollisions();
    }

    // When the death beat has fully played out, restart into a fresh Run and
    // hand back the SP earned so the caller can bank it.
    if (this.runState.consumeRestart()) {
      this.onRestart(this.score.value, this.spCollected);
    }
  }

  private spawnEnemy(name: EnemyName): void {
    if (name === 'Shooter') {
      // Aim at the live Ship; hold fire (null) once the Ship is gone.
      this.area.add(new Shooter(() => (this.ship.dead ? null : { x: this.ship.x, y: this.ship.y })));
    } else {
      this.area.add(new Rock());
    }
  }

  private spawnResource(name: ResourceName): void {
    const x = randomRange(40, PLAYFIELD_WIDTH - 40);
    const y = randomRange(40, PLAYFIELD_HEIGHT - 40);
    switch (name) {
      case 'Ammo':
        this.area.add(new AmmoPickup(x, y));
        break;
      case 'Boost':
        this.area.add(new BoostPickup(x, y));
        break;
      case 'Attack':
        this.area.add(new AttackPickup(x, y));
        break;
      case 'SP':
        this.area.add(new SpPickup(x, y));
        break;
    }
  }

  private resolveCollisions(): void {
    this.resolveProjectileHits();
    this.resolveShipDamage();
    this.resolvePickups();
  }

  private resolveProjectileHits(): void {
    const projectiles = this.area.getGameObjectsByClass<Projectile>(Projectile);
    for (const p of projectiles) {
      if (p.dead) continue;
      const [enemy] = this.area.queryCircleOverlap<Enemy>(p, Enemy);
      if (!enemy) continue;

      const wasAlive = !enemy.dead;
      enemy.takeDamage(p.damage);
      p.destroy();

      if (wasAlive && enemy.dead) {
        this.onEnemyKilled(enemy);
        this.sfx?.enemyDeath();
      } else {
        this.sfx?.enemyHit();
      }
    }
  }

  private onEnemyKilled(enemy: Enemy): void {
    this.score.addKill(enemy.scoreValue);
    this.area.add(new Explosion(enemy.x, enemy.y, { color: Palette.hp, count: 8 }));
    if (Math.random() < this.ammoDropChance) {
      this.area.add(new AmmoPickup(enemy.x, enemy.y));
    }
  }

  private resolveShipDamage(): void {
    if (this.ship.dead) return;

    for (const proj of this.area.queryCircleOverlap<EnemyProjectile>(this.ship, EnemyProjectile)) {
      const killed = this.ship.takeDamage(proj.damage);
      proj.destroy();
      if (this.onShipHit(killed)) return;
    }

    for (const enemy of this.area.queryCircleOverlap<Enemy>(this.ship, Enemy)) {
      const killed = this.ship.takeDamage(ENEMY_CONTACT_DAMAGE);
      // The enemy is destroyed on impact (no Score, no drop — it wasn't shot).
      this.area.add(new Explosion(enemy.x, enemy.y, { color: Palette.hp, count: 6 }));
      enemy.destroy();
      if (this.onShipHit(killed)) return;
    }
  }

  /**
   * React to the Ship taking a hit. Plays the hit sound; if the hit was fatal,
   * begins the death beat and returns true so callers stop applying further hits.
   */
  private onShipHit(killed: boolean): boolean {
    if (killed) {
      this.onShipDeath();

      return true;
    }
    this.sfx?.shipHit();

    return false;
  }

  private onShipDeath(): void {
    this.sfx?.shipDeath();
    this.area.add(
      new Explosion(this.ship.x, this.ship.y, {
        color: Palette.default,
        count: 24,
        minSpeed: 80,
        maxSpeed: 240,
        lifetime: 0.8,
      }),
    );
    this.ship.destroy();
    this.runState.die(this.score.value);
  }

  private resolvePickups(): void {
    if (this.ship.dead) return;
    for (const pickup of this.area.queryCircleOverlap<Pickup>(this.ship, Pickup)) {
      this.collect(pickup);
    }
  }

  private collect(pickup: Pickup): void {
    switch (pickup.kind) {
      case 'Ammo':
        this.attacks.addAmmo(this.ammoPickupAmount);
        break;
      case 'Boost':
        // The Ship owns and clamps its own Boost meter.
        this.ship.addBoost(this.boostPickupAmount);
        break;
      case 'Attack':
        if (pickup instanceof AttackPickup) {
          applyAttackPickup(this.attacks, pickup.attackName);
        }
        break;
      case 'SP':
        // Bank SP toward the Run total; the caller persists it on Run end.
        this.spCollected += this.spPickupValue;
        break;
    }

    this.score.addPickup(pickup.kind);
    this.area.add(new CollectEffect(pickup.x, pickup.y, pickup.color));
    this.sfx?.pickup();
    pickup.destroy();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = Palette.background;
    ctx.fillRect(0, 0, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT);

    this.area.draw(ctx);

    this.hud.draw(ctx, {
      hp: this.ship.dead ? 0 : this.ship.health.current,
      maxHp: this.ship.health.max,
      ammo: this.attacks.ammo,
      maxAmmo: this.attacks.maxAmmo,
      boost: this.ship.boost.current,
      maxBoost: this.ship.boost.max,
      attackName: this.attacks.currentAttackName,
      score: this.score.value,
      sp: this.spCollected,
      lastRunScore: this.runState.showLastRun ? this.runState.lastRunScore : null,
    });
  }

  destroy(): void {
    this.timer.clear();
    this.area.clear();
  }
}
