import { Area } from '../core/Area';
import type { Room } from '../core/Room';
import { Timer } from '../engine/timer';
import type { Input } from '../engine/input';
import { Palette } from '../game/palette';
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from '../game/constants';
import { Ship } from '../objects/ship/Ship';
import { AttackSystem } from '../combat/AttackSystem';
import { Projectile } from '../combat/Projectile';
import { Director, type EnemyName, type ResourceName } from '../director/Director';
import { Enemy } from '../enemies/Enemy';
import { Rock } from '../enemies/Rock';
import { Shooter } from '../enemies/Shooter';
import { EnemyProjectile } from '../enemies/EnemyProjectile';
import { Pickup } from '../pickups/Pickup';
import { AmmoPickup } from '../pickups/AmmoPickup';
import { BoostPickup } from '../pickups/BoostPickup';
import { AttackPickup } from '../pickups/AttackPickup';
import {
  applyAmmoPickup,
  applyAttackPickup,
  BOOST_PICKUP_AMOUNT,
} from '../pickups/pickupEffects';
import { Explosion } from '../effects/Explosion';
import { CollectEffect } from '../effects/CollectEffect';
import { Score } from '../score/Score';
import { RunState } from '../runstate/RunState';
import { Hud } from '../hud/Hud';
import type { Sfx } from '../audio/Sfx';
import { randomRange } from '../engine/mathutils';

/** Contact damage an enemy deals to the Ship on collision. */
const ENEMY_CONTACT_DAMAGE = 30;

/** Chance an enemy drops an Ammo pickup on death. */
const AMMO_DROP_CHANCE = 0.2;

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
  private readonly score = new Score();
  private readonly runState: RunState;
  private readonly hud = new Hud();
  private readonly sfx: Sfx | null;
  private readonly onRestart: (lastRunScore: number) => void;

  /**
   * @param input       Shared keyboard tracker.
   * @param options.sfx Shared Sfx instance (audio persists across Runs). Optional.
   * @param options.lastRunScore Previous Run's Score, shown briefly on the HUD.
   * @param options.onRestart Called with the final Score when the death beat ends
   *                          so the caller can swap in a fresh Stage.
   */
  constructor(
    input: Input,
    options: {
      sfx?: Sfx | null;
      lastRunScore?: number | null;
      onRestart?: (lastRunScore: number) => void;
    } = {},
  ) {
    this.input = input;
    this.sfx = options.sfx ?? null;
    this.onRestart = options.onRestart ?? (() => {});
    this.runState = new RunState(options.lastRunScore ?? null);

    this.ship = this.area.add(
      new Ship(this.input, PLAYFIELD_WIDTH / 2, PLAYFIELD_HEIGHT / 2, this.timer),
    );

    // The AttackSystem fires from the Ship each tick; its Projectiles and shoot
    // effects register into this Area and draw in the current Attack's color.
    this.attacks = new AttackSystem(this.area, this.timer);

    // The Director drives spawns via callbacks; it holds no GameObject refs.
    this.director = new Director({
      spawnEnemy: (name) => this.spawnEnemy(name),
      spawnResource: (name) => this.spawnResource(name),
    });
  }

  /** Current Run's Score. Read-only view for callers/tests. */
  get currentScore(): number {
    return this.score.value;
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

    // When the death beat has fully played out, restart into a fresh Run.
    if (this.runState.consumeRestart()) {
      this.onRestart(this.score.value);
    }
  }

  // --- Spawning (Director callbacks) --------------------------------------

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
    }
  }

  // --- Collision response --------------------------------------------------

  private resolveCollisions(): void {
    this.resolveProjectileHits();
    this.resolveShipDamage();
    this.resolvePickups();
  }

  /** Ship Projectiles that overlap an enemy deal damage; the projectile dies. */
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

  /** Award Score, spawn an explosion, and roll an Ammo drop when an enemy dies. */
  private onEnemyKilled(enemy: Enemy): void {
    this.score.addKill(enemy.scoreValue);
    this.area.add(new Explosion(enemy.x, enemy.y, { color: Palette.hp, count: 8 }));
    if (Math.random() < AMMO_DROP_CHANCE) {
      this.area.add(new AmmoPickup(enemy.x, enemy.y));
    }
  }

  /** Enemies and EnemyProjectiles that touch the Ship damage it. */
  private resolveShipDamage(): void {
    if (this.ship.dead) return;

    // EnemyProjectiles: deal their damage and self-destruct on contact.
    for (const proj of this.area.queryCircleOverlap<EnemyProjectile>(this.ship, EnemyProjectile)) {
      const killed = this.ship.takeDamage(proj.damage);
      proj.destroy();
      if (this.onShipHit(killed)) return;
    }

    // Enemy bodies: deal contact damage and destroy themselves on impact.
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
    // A large screen-ward explosion where the Ship fell.
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

  /** Ship-Pickup overlaps: apply the effect, award Score, effect + sound. */
  private resolvePickups(): void {
    if (this.ship.dead) return;
    for (const pickup of this.area.queryCircleOverlap<Pickup>(this.ship, Pickup)) {
      this.collect(pickup);
    }
  }

  private collect(pickup: Pickup): void {
    switch (pickup.kind) {
      case 'Ammo':
        applyAmmoPickup(this.attacks);
        break;
      case 'Boost':
        // The Ship owns and clamps its own Boost meter.
        this.ship.addBoost(BOOST_PICKUP_AMOUNT);
        break;
      case 'Attack':
        if (pickup instanceof AttackPickup) {
          applyAttackPickup(this.attacks, pickup.attackName);
        }
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
      lastRunScore: this.runState.showLastRun ? this.runState.lastRunScore : null,
    });
  }

  destroy(): void {
    this.timer.clear();
    this.area.clear();
  }
}
