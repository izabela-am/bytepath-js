/**
 * The Ship has exactly one Attack at a time (CONTEXT.md); collecting an Attack
 * pickup replaces it.
 *
 * Ported from a327ex's BYTEPATH tutorial "attacks" table. Values follow the
 * tutorial's spirit; deviations are noted inline.
 */
import { Palette, type PaletteColor } from '../game/palette';

export type AttackName = 'Neutral' | 'Double' | 'Spread';

export interface ProjectileSpawnSpec {
  readonly shots: readonly ShotSpec[];
}

export interface ShotSpec {
  /** Added to the source heading, in radians. */
  readonly angleOffset: number;
  /** Half-angle (radians) of uniform random spread around the shot. */
  readonly randomSpreadHalfAngle?: number;
}

export interface Attack {
  readonly name: AttackName;
  /** Ammo consumed per trigger (a trigger may fire multiple projectiles). */
  readonly ammoCost: number;
  /** Seconds between automatic triggers. */
  readonly fireInterval: number;
  readonly spawn: ProjectileSpawnSpec;
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

  // Costs 2 Ammo per trigger (the brief calls it "2/shot"; a trigger fires the pair).
  Double: {
    name: 'Double',
    ammoCost: 2,
    fireInterval: DEFAULT_FIRE_INTERVAL,
    spawn: {
      shots: [{ angleOffset: -12 * DEG }, { angleOffset: 12 * DEG }],
    },
    color: Palette.boost,
  },

  // Faster 0.16 s cadence, following the tutorial's spirit of Spread being a
  // rapid, scattered attack.
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
