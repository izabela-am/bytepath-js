import { describe, it, expect } from 'vitest';
import { Stage } from './Stage';
import type { Input } from '../engine/input';
import { Projectile } from '../combat/Projectile';
import { Rock } from '../enemies/Rock';
import { Enemy } from '../enemies/Enemy';
import { EnemyProjectile } from '../enemies/EnemyProjectile';
import { AmmoPickup } from '../pickups/AmmoPickup';
import { SpPickup } from '../pickups/SpPickup';
import { identityModifiers, type RunModifiers } from '../skilltree/modifiers';
import { SHIP_MAX_HP } from '../objects/ship/health';

// A no-input keyboard so the Ship neither steers nor boosts during a test tick.
function idleInput(): Input {
  return {
    isDown: () => false,
    pressed: () => false,
    anyDown: () => false,
    endFrame: () => {},
    destroy: () => {},
  } as unknown as Input;
}

const DT = 1 / 60;

describe('Stage collision wiring', () => {
  it('a Ship Projectile that hits an enemy kills it and awards its Score', () => {
    const stage = new Stage(idleInput());
    const scoreBefore = stage.currentScore;

    // Place a Rock and a lethal Projectile right on top of it.
    const rock = new Rock();
    rock.x = 100;
    rock.y = 100;
    stage.area.add(rock);
    stage.area.add(new Projectile(100, 100, { angle: 0, damage: 1000 }));

    stage.update(DT);

    expect(rock.dead).toBe(true);
    // Score jumped by at least the Rock's value (plus a little survival).
    expect(stage.currentScore).toBeGreaterThanOrEqual(scoreBefore + rock.scoreValue);
    // No live enemies remain from this collision.
    expect(stage.area.getGameObjectsByClass(Enemy).length).toBe(0);
  });

  it('an EnemyProjectile that hits the Ship damages it', () => {
    const stage = new Stage(idleInput());
    const hpBefore = stage.ship.hp;

    const proj = new EnemyProjectile(stage.ship.x, stage.ship.y, 0);
    stage.area.add(proj);

    stage.update(DT);

    expect(stage.ship.hp).toBeLessThan(hpBefore);
    expect(proj.dead).toBe(true);
  });

  it('collecting an Ammo pickup awards its Score bonus', () => {
    const stage = new Stage(idleInput());
    const scoreBefore = stage.currentScore;

    const pickup = new AmmoPickup(stage.ship.x, stage.ship.y);
    stage.area.add(pickup);

    stage.update(DT);

    expect(pickup.dead).toBe(true);
    expect(stage.currentScore).toBeGreaterThanOrEqual(scoreBefore + 50);
  });

  it('the Ship dying ends the Run and reports the final Score on restart', () => {
    let restartedWith: number | null = null;
    const stage = new Stage(idleInput(), {
      onRestart: (finalScore) => {
        restartedWith = finalScore;
      },
    });

    // Repeatedly ram the Ship with fresh contact enemies until it dies. Each hit
    // opens an invulnerability window, so we advance a few ticks between hits.
    for (let i = 0; i < 20 && stage.isRunActive; i++) {
      const rock = new Rock();
      rock.x = stage.ship.x;
      rock.y = stage.ship.y;
      stage.area.add(rock);
      // Enough ticks to clear the invulnerability window before the next ram.
      for (let t = 0; t < 40; t++) stage.update(DT);
    }

    expect(stage.isRunActive).toBe(false);

    // Play out the death beat; eventually the restart fires with a Score.
    for (let t = 0; t < 200 && restartedWith === null; t++) stage.update(DT);
    expect(restartedWith).not.toBeNull();
    expect(restartedWith!).toBeGreaterThanOrEqual(0);
  });
});

describe('Stage SP accounting', () => {
  it('collecting an SP pickup banks SP and awards its Score bonus', () => {
    const stage = new Stage(idleInput());
    const scoreBefore = stage.currentScore;
    expect(stage.spEarned).toBe(0);

    const pickup = new SpPickup(stage.ship.x, stage.ship.y);
    stage.area.add(pickup);

    stage.update(DT);

    expect(pickup.dead).toBe(true);
    // Identity modifiers: base 1 SP per pickup.
    expect(stage.spEarned).toBe(1);
    // SP pickups award a Score bonus like other pickups (PICKUP_BONUS.SP = 50).
    expect(stage.currentScore).toBeGreaterThanOrEqual(scoreBefore + 50);
  });

  it('reports SP earned as the second onRestart argument', () => {
    let restartScore: number | null = null;
    let restartSp: number | null = null;
    const stage = new Stage(idleInput(), {
      onRestart: (finalScore, spEarned) => {
        restartScore = finalScore;
        restartSp = spEarned;
      },
    });

    // Collect one SP pickup, then ram the Ship to death.
    stage.area.add(new SpPickup(stage.ship.x, stage.ship.y));
    stage.update(DT);
    expect(stage.spEarned).toBe(1);

    for (let i = 0; i < 20 && stage.isRunActive; i++) {
      const rock = new Rock();
      rock.x = stage.ship.x;
      rock.y = stage.ship.y;
      stage.area.add(rock);
      for (let t = 0; t < 40; t++) stage.update(DT);
    }
    for (let t = 0; t < 200 && restartSp === null; t++) stage.update(DT);

    expect(restartSp).toBe(1);
    expect(restartScore!).toBeGreaterThanOrEqual(0);
  });

  it('scales SP banked per pickup by the spPickupValue modifier', () => {
    // +150% => applyModifier(1, {percent:1.5}) = 2.5 => round => 3 SP per pickup.
    const mods: RunModifiers = identityModifiers();
    mods.spPickupValue = { flat: 0, percent: 1.5 };
    const stage = new Stage(idleInput(), { runModifiers: mods });

    stage.area.add(new SpPickup(stage.ship.x, stage.ship.y));
    stage.update(DT);

    expect(stage.spEarned).toBe(3);
  });
});

describe('Stage modifier threading', () => {
  it('identity modifiers leave the Ship at v1 max HP', () => {
    const stage = new Stage(idleInput(), { runModifiers: identityModifiers() });
    expect(stage.ship.health.max).toBe(SHIP_MAX_HP);
  });

  it('an omitted runModifiers option is identity (exact v1 behavior)', () => {
    const stage = new Stage(idleInput());
    expect(stage.ship.health.max).toBe(SHIP_MAX_HP);
    expect(stage.ship.hp).toBe(SHIP_MAX_HP);
  });

  it('a non-identity maxHp modifier raises the Ship max HP', () => {
    const mods: RunModifiers = identityModifiers();
    mods.maxHp = { flat: 50, percent: 0 };
    const stage = new Stage(idleInput(), { runModifiers: mods });
    expect(stage.ship.health.max).toBe(SHIP_MAX_HP + 50);
    expect(stage.ship.hp).toBe(SHIP_MAX_HP + 50);
  });

  it('a scoreMultiplier modifier scales kill Score', () => {
    const mods: RunModifiers = identityModifiers();
    mods.scoreMultiplier = { flat: 0, percent: 1 }; // x2
    const stage = new Stage(idleInput(), { runModifiers: mods });

    const rock = new Rock();
    rock.x = 100;
    rock.y = 100;
    stage.area.add(rock);
    stage.area.add(new Projectile(100, 100, { angle: 0, damage: 1000 }));

    const before = stage.currentScore;
    stage.update(DT);

    // The kill awards double its scoreValue under the x2 multiplier.
    expect(stage.currentScore - before).toBeGreaterThanOrEqual(rock.scoreValue * 2);
  });
});
