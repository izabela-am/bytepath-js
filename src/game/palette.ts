/**
 * BYTEPATH-style palette. All geometry is drawn from this small fixed set so
 * the game reads as a coherent neon-on-dark arcade piece. Resource colors map
 * to the ubiquitous language: hp/ammo/boost/score each own a hue.
 *
 * Colors are plain CSS strings — the render layer stays swappable, and callers
 * pass these straight to `ctx.strokeStyle` / `ctx.fillStyle`.
 */
export const Palette = {
  background: '#111111',
  default: '#f0f0f0',
  defaultDim: '#8c8c8c',
  hp: '#e0524a',
  ammo: '#54d669',
  boost: '#4ad2e0',
  score: '#f4e04d',

  /** SP — the persistent Skill Tree currency. */
  sp: '#b36bff',

  /** Negative / flash accent — used for hit flashes and warnings. */
  negative: '#ffffff',
} as const;

export type PaletteColor = (typeof Palette)[keyof typeof Palette];
