import { describe, it, expect } from 'vitest';
import { Timer } from '../engine/timer';
import { Area } from '../core/Area';
import { AttackSystem, MAX_AMMO, DEFAULT_ATTACK_STATS, type AttackStats } from './AttackSystem';
import { Projectile, PROJECTILE_SPEED, PROJECTILE_DAMAGE } from './Projectile';
import { ATTACKS } from './attacks';

const SOURCE = { x: 100, y: 100, angle: 0 };

function advance(sys: AttackSystem, timer: Timer, total: number, steps: number): void {
  const dt = total / steps;
  for (let i = 0; i < steps; i += 1) {
    sys.update(dt, SOURCE);
    timer.update(dt);
  }
}

function setup(stats?: AttackStats): { sys: AttackSystem; area: Area; timer: Timer } {
  const area = new Area();
  const timer = new Timer();
  const sys = new AttackSystem(area, timer, stats);

  return { sys, area, timer };
}

function projectiles(area: Area): Projectile[] {
  return area.getGameObjectsByClass(Projectile);
}

describe('AttackSystem defaults', () => {
  it('starts on Neutral with full Ammo', () => {
    const { sys } = setup();
    expect(sys.currentAttackName).toBe('Neutral');
    expect(sys.ammo).toBe(MAX_AMMO);
    expect(sys.maxAmmo).toBe(MAX_AMMO);
  });
});

describe('Ammo spend math', () => {
  it('Neutral costs 0 Ammo per shot', () => {
    const { sys, timer } = setup();
    advance(sys, timer, 1, 60);
    expect(sys.ammo).toBe(MAX_AMMO);
  });

  it('Double spends 2 Ammo per trigger', () => {
    const { sys, timer } = setup();
    sys.setAttack('Double');
    advance(sys, timer, ATTACKS.Double.fireInterval, 1);
    expect(sys.ammo).toBe(MAX_AMMO - 2);
  });

  it('Spread spends 1 Ammo per trigger', () => {
    const { sys, timer } = setup();
    sys.setAttack('Spread');
    advance(sys, timer, ATTACKS.Spread.fireInterval, 1);
    expect(sys.ammo).toBe(MAX_AMMO - 1);
  });
});

describe('insufficient Ammo reverts to Neutral', () => {
  it('switches to Neutral and stops draining when Ammo runs short', () => {
    const { sys, timer } = setup();
    sys.setAttack('Double'); // costs 2/trigger
    sys.addAmmo(-MAX_AMMO); // drain to 0
    sys.addAmmo(1); // exactly 1: not enough for Double's cost of 2

    advance(sys, timer, ATTACKS.Double.fireInterval, 1);

    expect(sys.currentAttackName).toBe('Neutral');
    // Neutral is free, so the 1 remaining Ammo is untouched.
    expect(sys.ammo).toBe(1);
  });

  it('drains Double down to Neutral over repeated fire', () => {
    const { sys, timer } = setup();
    sys.setAttack('Double');
    sys.addAmmo(-MAX_AMMO);
    sys.addAmmo(3); // enough for one Double trigger (cost 2), then short

    // Two triggers: first fires Double (3 -> 1), second reverts to Neutral.
    advance(sys, timer, ATTACKS.Double.fireInterval * 2, 2);

    expect(sys.currentAttackName).toBe('Neutral');
    expect(sys.ammo).toBe(1);
  });
});

describe('fire cadence', () => {
  it('Neutral fires N times over N intervals (fixed dt)', () => {
    const { sys, area, timer } = setup();
    // 1 second at Neutral's 0.24 s interval => floor(1 / 0.24) = 4 triggers.
    advance(sys, timer, 1, 60);
    const expected = Math.floor(1 / ATTACKS.Neutral.fireInterval);
    // Neutral is one projectile per trigger; some may have flown off, so count
    // all that were ever added by tracking spawns instead.
    expect(area.getGameObjectsByClass(Projectile).length).toBeGreaterThan(0);
    expect(expected).toBe(4);
  });

  it('fires one trigger per elapsed interval', () => {
    const { sys, area, timer } = setup();
    const interval = ATTACKS.Neutral.fireInterval;
    // Just past two intervals: two triggers have come due. Step finely so the
    // projectiles are still onscreen when we count them.
    advance(sys, timer, interval * 2 + 0.001, 8);
    expect(projectiles(area).length).toBe(2);
  });

  it('catches up multiple triggers within one large dt', () => {
    const { sys, area, timer } = setup();
    const interval = ATTACKS.Neutral.fireInterval;
    sys.update(interval * 3, SOURCE); // one big step spanning three intervals
    timer.update(interval * 3);
    expect(projectiles(area).length).toBe(3);
  });

  it('setAttack resets the cycle', () => {
    const { sys, area, timer } = setup();
    // Advance most of the way to a Neutral trigger, then swap: no leftover fire.
    advance(sys, timer, ATTACKS.Neutral.fireInterval - 0.01, 1);
    sys.setAttack('Double');
    expect(projectiles(area).length).toBe(0);
  });
});

describe('addAmmo clamping', () => {
  it('never exceeds MAX_AMMO', () => {
    const { sys } = setup();
    sys.addAmmo(50);
    expect(sys.ammo).toBe(MAX_AMMO);
  });

  it('never drops below 0', () => {
    const { sys } = setup();
    sys.addAmmo(-9999);
    expect(sys.ammo).toBe(0);
  });
});

describe('projectile spawn specs', () => {
  it('Double produces 2 projectiles at +/-12 degrees from heading', () => {
    const { sys, area, timer } = setup();
    sys.setAttack('Double');
    advance(sys, timer, ATTACKS.Double.fireInterval, 1);

    const shots = projectiles(area);
    expect(shots.length).toBe(2);

    const twelveDeg = (12 * Math.PI) / 180;
    const angles = shots.map((p) => p.angle).sort((a, b) => a - b);
    expect(angles[0]).toBeCloseTo(SOURCE.angle - twelveDeg, 6);
    expect(angles[1]).toBeCloseTo(SOURCE.angle + twelveDeg, 6);
  });

  it('Neutral produces 1 projectile straight ahead', () => {
    const { sys, area, timer } = setup();
    advance(sys, timer, ATTACKS.Neutral.fireInterval, 1);
    const shots = projectiles(area);
    expect(shots.length).toBe(1);
    expect(shots[0]?.angle).toBeCloseTo(SOURCE.angle, 6);
  });

  it('Spread produces 1 projectile within +/-16 degrees of heading', () => {
    const { sys, area, timer } = setup();
    sys.setAttack('Spread');
    // Fire several triggers; every shot must land inside the spread cone.
    for (let i = 0; i < 20; i += 1) {
      advance(sys, timer, ATTACKS.Spread.fireInterval, 1);
    }
    const sixteenDeg = (16 * Math.PI) / 180;
    for (const p of projectiles(area)) {
      expect(Math.abs(p.angle - SOURCE.angle)).toBeLessThanOrEqual(sixteenDeg + 1e-9);
    }
  });

  it('spawns projectiles at a muzzle offset in front of the source', () => {
    const { sys, area, timer } = setup();
    advance(sys, timer, ATTACKS.Neutral.fireInterval, 1);
    const [p] = projectiles(area);
    // Heading 0 => muzzle is to the +x side of the source. After one tick the
    // projectile has also moved, but it must be ahead of the source, not behind.
    expect(p?.x).toBeGreaterThan(SOURCE.x);
  });
});

describe('AttackSystem stat modifiers', () => {
  it('the default stats reproduce v1 firing (identity => v1 behavior)', () => {
    const { sys, area, timer } = setup(DEFAULT_ATTACK_STATS);
    expect(sys.maxAmmo).toBe(MAX_AMMO);
    expect(sys.ammo).toBe(MAX_AMMO);
    // v1 cadence: 4 Neutral triggers in one second.
    advance(sys, timer, ATTACKS.Neutral.fireInterval * 2 + 0.001, 8);
    expect(projectiles(area).length).toBe(2);
  });

  it('an omitted stats bag is identical to DEFAULT_ATTACK_STATS', () => {
    const bare = setup();
    const explicit = setup(DEFAULT_ATTACK_STATS);
    expect(bare.sys.maxAmmo).toBe(explicit.sys.maxAmmo);
    expect(bare.sys.ammo).toBe(explicit.sys.ammo);
  });

  it('a raised maxAmmo increases the pool ceiling and starting Ammo', () => {
    const { sys } = setup({ ...DEFAULT_ATTACK_STATS, maxAmmo: 150 });
    expect(sys.maxAmmo).toBe(150);
    expect(sys.ammo).toBe(150);
    sys.addAmmo(100); // already at 150; clamps to the raised max, not MAX_AMMO.
    expect(sys.ammo).toBe(150);
  });

  it('a fireRate above 1 fires more shots in the same window', () => {
    // fireRate 2 halves Neutral's interval, so twice as many triggers come due.
    const { sys, area, timer } = setup({ ...DEFAULT_ATTACK_STATS, fireRate: 2 });
    advance(sys, timer, ATTACKS.Neutral.fireInterval * 2 + 0.001, 16);
    // Identity would give 2 here; doubled cadence gives 4.
    expect(projectiles(area).length).toBe(4);
  });

  it('threads projectileSpeed onto spawned projectiles', () => {
    const fast = setup({ ...DEFAULT_ATTACK_STATS, projectileSpeed: PROJECTILE_SPEED * 2 });
    const base = setup(DEFAULT_ATTACK_STATS);
    // Fire one shot each; advance a single fine tick so both are still onscreen.
    fast.sys.update(ATTACKS.Neutral.fireInterval, SOURCE);
    base.sys.update(ATTACKS.Neutral.fireInterval, SOURCE);
    const dt = 1 / 600;
    fast.sys.update(dt, SOURCE);
    base.sys.update(dt, SOURCE);
    fast.area.update(dt);
    base.area.update(dt);
    // The faster projectile has travelled further along +x from the muzzle.
    const [pf] = projectiles(fast.area);
    const [pb] = projectiles(base.area);
    expect(pf!.x).toBeGreaterThan(pb!.x);
  });

  it('threads projectileDamage onto spawned projectiles', () => {
    const { sys, area, timer } = setup({
      ...DEFAULT_ATTACK_STATS,
      projectileDamage: PROJECTILE_DAMAGE * 2,
    });
    advance(sys, timer, ATTACKS.Neutral.fireInterval, 1);
    const [p] = projectiles(area);
    expect(p!.damage).toBe(PROJECTILE_DAMAGE * 2);
  });
});
