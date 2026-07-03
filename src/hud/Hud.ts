/**
 * The heads-up display, drawn by the Stage after the Area so it sits on top of
 * gameplay. Tutorial-minimal: three resource bars (HP, Ammo, Boost) with numeric
 * values along the bottom, the current Attack name, the Score at top-right, and a
 * transient "LAST RUN" line at the start of a Run.
 *
 * The Hud is stateless — it draws from a plain snapshot the Stage assembles each
 * frame, so it holds no game references and only ever touches the canvas in
 * `draw`. All layout is in the fixed 480x270 playfield.
 */
import { Palette } from '../game/palette';
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from '../game/constants';
import { clamp } from '../engine/mathutils';

/** Everything the HUD needs for one frame. */
export interface HudSnapshot {
  hp: number;
  maxHp: number;
  ammo: number;
  maxAmmo: number;
  boost: number;
  maxBoost: number;
  attackName: string;
  score: number;
  /** Previous Run's Score to show as "LAST RUN", or null to hide it. */
  lastRunScore: number | null;
}

const BAR_WIDTH = 70;
const BAR_HEIGHT = 5;
const BAR_GAP = 4;
const MARGIN = 6;

export class Hud {
  draw(ctx: CanvasRenderingContext2D, s: HudSnapshot): void {
    ctx.save();
    ctx.font = '8px monospace';
    ctx.textBaseline = 'alphabetic';

    // Bottom-left resource bars, stacked upward: HP, Ammo, Boost.
    const baseY = PLAYFIELD_HEIGHT - MARGIN - BAR_HEIGHT;
    this.bar(ctx, MARGIN, baseY, s.hp, s.maxHp, Palette.hp, `HP ${Math.round(s.hp)}`);
    this.bar(
      ctx,
      MARGIN,
      baseY - (BAR_HEIGHT + BAR_GAP + 8),
      s.ammo,
      s.maxAmmo,
      Palette.ammo,
      `AMMO ${Math.round(s.ammo)}`,
    );
    this.bar(
      ctx,
      MARGIN,
      baseY - 2 * (BAR_HEIGHT + BAR_GAP + 8),
      s.boost,
      s.maxBoost,
      Palette.boost,
      `BOOST ${Math.round(s.boost)}`,
    );

    // Current Attack name, bottom-right.
    ctx.fillStyle = Palette.default;
    ctx.textAlign = 'right';
    ctx.fillText(s.attackName.toUpperCase(), PLAYFIELD_WIDTH - MARGIN, PLAYFIELD_HEIGHT - MARGIN);

    // Score, top-right.
    ctx.fillStyle = Palette.score;
    ctx.fillText(`${s.score}`, PLAYFIELD_WIDTH - MARGIN, MARGIN + 8);

    // Transient "LAST RUN" line, top-left.
    if (s.lastRunScore !== null) {
      ctx.fillStyle = Palette.defaultDim;
      ctx.textAlign = 'left';
      ctx.fillText(`LAST RUN ${s.lastRunScore}`, MARGIN, MARGIN + 8);
    }

    ctx.restore();
  }

  /** Draw a labeled resource bar: outline, filled portion, then the label above. */
  private bar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    value: number,
    max: number,
    color: string,
    label: string,
  ): void {
    const frac = max > 0 ? clamp(value / max, 0, 1) : 0;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, BAR_WIDTH * frac, BAR_HEIGHT);

    ctx.strokeStyle = Palette.defaultDim;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, BAR_WIDTH, BAR_HEIGHT);

    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y - 2);
  }
}
