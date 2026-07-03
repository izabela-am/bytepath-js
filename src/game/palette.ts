/**
 * BYTEPATH-style palette. All geometry is drawn from this small fixed set so
 * the game reads as a coherent neon-on-dark arcade piece. Resource colors map
 * to the ubiquitous language: hp/ammo/boost/score each own a hue.
 *
 * Colors are plain CSS strings — the render layer stays swappable, and callers
 * pass these straight to `ctx.strokeStyle` / `ctx.fillStyle`.
 */
export const Palette = {
  /** Playfield background. */
  background: '#111111',

  /** Default geometry color for the Ship and neutral shapes. */
  default: '#f0f0f0',

  /** A slightly dimmer default for secondary/background geometry. */
  defaultDim: '#8c8c8c',

  /** HP / damage. */
  hp: '#e0524a',

  /** Ammo resource. */
  ammo: '#54d669',

  /** Boost resource. */
  boost: '#4ad2e0',

  /** Score. */
  score: '#f4e04d',

  /** Negative / flash accent — used for hit flashes and warnings. */
  negative: '#ffffff',
} as const;

export type PaletteColor = (typeof Palette)[keyof typeof Palette];
