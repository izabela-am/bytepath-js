import { describe, it, expect } from 'vitest';
import { Stage } from './Stage';
import type { Input } from '../engine/input';
import { Projectile } from '../combat/Projectile';
import { Rock } from '../enemies/Rock';
import { Enemy } from '../enemies/Enemy';
import { EnemyProjectile } from '../enemies/EnemyProjectile';
import { AmmoPickup } from '../pickups/AmmoPickup';

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
