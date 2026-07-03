/**
 * The Attack table. The Ship has exactly one Attack at a time (CONTEXT.md);
 * collecting an Attack pickup replaces it. Each entry describes how firing
 * behaves: how much Ammo a shot costs, how often it fires, what projectiles it
 * spawns, and the color those projectiles draw in.
 *
 * Ported from a327ex's BYTEPATH tutorial "attacks" table. Values follow the
 * tutorial's spirit; deviations are noted inline.
 */
import { Palette, type PaletteColor } from '../game/palette';

/** Name of an Attack. Also the key used by AttackSystem.setAttack. */
export type AttackName = 'Neutral' | 'Double' | 'Spread';

/**
 * How a single trigger of an Attack lays out its projectiles. Each entry in
 * `shots` becomes one Projectile, fired relative to the source's heading.
 */
export interface ProjectileSpawnSpec {
  /**
   * One shot per entry. `angleOffset` (radians) is added to the source heading;
   * `randomSpreadHalfAngle` (radians, optional) additionally jitters the shot by
   * a uniform value in [-half, +half].
   */
  readonly shots: readonly ShotSpec[];
}

export interface ShotSpec {
  /** Fixed angle offset from the source heading, in radians. */
  readonly angleOffset: number;
  /** Optional half-angle (radians) of uniform random spread around the shot. */
  readonly randomSpreadHalfAngle?: number;
}

export interface Attack {
  readonly name: AttackName;
  /** Ammo consumed per trigger (a trigger may fire multiple projectiles). */
  readonly ammoCost: number;
  /** Seconds between automatic triggers. */
  readonly fireInterval: number;
  /** Projectile layout for one trigger. */
  readonly spawn: ProjectileSpawnSpec;
  /** Color the projectiles draw in. */
  readonly color: PaletteColor;
}

const DEG = Math.PI / 180;

/** Default fire interval, matching the tutorial's baseline attack cadence. */
export const DEFAULT_FIRE_INTERVAL = 0.24;

export const ATTACKS: Record<AttackName, Attack> = {
  // Free, single straight shot — the fallback Attack. Ammo cost 0 so it can
  // always fire; running out of Ammo reverts the Ship to this.
  Neutral: {
    name: 'Neutral',
    ammoCost: 0,
    fireInterval: DEFAULT_FIRE_INTERVAL,
    spawn: { shots: [{ angleOffset: 0 }] },
    color: Palette.default,
  },

  // Two projectiles fanned symmetrically at +/-12 degrees. Costs 2 Ammo per
  // trigger (the brief calls it "2/shot"; a trigger fires the pair).
  Double: {
    name: 'Double',
    ammoCost: 2,
    fireInterval: DEFAULT_FIRE_INTERVAL,
    spawn: {
      shots: [{ angleOffset: -12 * DEG }, { angleOffset: 12 * DEG }],
    },
    color: Palette.boost,
  },

  // Single projectile fired at a random angle within +/-16 degrees. Costs 1
  // Ammo per trigger. Faster 0.16 s cadence, following the tutorial's spirit of
  // Spread being a rapid, scattered attack.
  Spread: {
    name: 'Spread',
    ammoCost: 1,
    fireInterval: 0.16,
    spawn: {
      shots: [{ angleOffset: 0, randomSpreadHalfAngle: 16 * DEG }],
    },
    color: Palette.score,
  },
};

/** The Attack every Ship starts with and reverts to when out of Ammo. */
export const NEUTRAL_ATTACK = ATTACKS.Neutral;
