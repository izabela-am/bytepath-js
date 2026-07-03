/**
 * Scanlines overlay — a global CRT-style post pass drawn LAST over everything
 * (Console and Stage alike) from main.ts's render step. It sells the boot-terminal
 * aesthetic (ADR 0002) with subtle horizontal scanlines, a faint vignette, and a
 * very slight brightness flicker.
 *
 * Performance: this runs every frame on top of the whole 480×270 playfield, so it
 * is deliberately cheap — a handful of `fillRect`s for the scanlines (one per
 * other row), one radial-gradient vignette fill, and one flicker veil. No
 * per-pixel `getImageData`/`putImageData` work (ADR 0001 keeps the render layer
 * swappable; this is the only place canvas drawing happens outside a Room).
 *
 * `time` is accumulated by the caller (main.ts) and passed in, so the flicker is
 * a pure function of elapsed time and the pass holds no state.
 */
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from './constants';

/** Vertical period of the scanlines in playfield pixels (draw on every other row). */
const LINE_PERIOD = 2;

/** Darkening alpha applied on the scanline rows. Subtle — the game stays readable. */
const LINE_ALPHA = 0.14;

/** Peak alpha of the vignette at the corners. */
const VIGNETTE_ALPHA = 0.35;

/** Amplitude of the flicker veil's alpha (added on top of a small baseline). */
const FLICKER_AMPLITUDE = 0.03;

/**
 * Draw the overlay. Call once per frame after every Room has drawn. `time` is the
 * accumulated render time in seconds and drives only the flicker; passing a
 * constant simply freezes it.
 */
export function drawScanlines(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save();

  // Horizontal scanlines: darken every other row with thin black bars. One
  // fillRect per line across ~135 lines is trivial at this resolution.
  ctx.fillStyle = `rgba(0, 0, 0, ${LINE_ALPHA})`;
  for (let y = 0; y < PLAYFIELD_HEIGHT; y += LINE_PERIOD) {
    ctx.fillRect(0, y, PLAYFIELD_WIDTH, 1);
  }

  // Vignette: a radial gradient darkening the corners, single fill.
  const cx = PLAYFIELD_WIDTH / 2;
  const cy = PLAYFIELD_HEIGHT / 2;
  const outer = Math.hypot(cx, cy);
  const vignette = ctx.createRadialGradient(cx, cy, outer * 0.55, cx, cy, outer);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, `rgba(0, 0, 0, ${VIGNETTE_ALPHA})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT);

  // Flicker: a whisper-thin bright veil whose alpha wavers with time. Two sines
  // at incommensurate rates keep it from looking like a clean pulse.
  const flicker =
    0.015 + FLICKER_AMPLITUDE * (0.5 + 0.5 * Math.sin(time * 11) * Math.sin(time * 3.3));
  ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, flicker)})`;
  ctx.fillRect(0, 0, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT);

  ctx.restore();
}
