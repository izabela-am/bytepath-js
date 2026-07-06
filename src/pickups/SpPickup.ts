/**
 * Banks SP toward the persistent Skill Tree currency when collected (CONTEXT.md:
 * "whatever the Ship collects during a Run is banked in full when the Run ends").
 * Drawn as a hexagon so it reads distinctly from the square (Ammo), diamond
 * (Boost), and triangle (Attack) glyphs.
 */
import { Pickup } from './Pickup';
import { Palette, type PaletteColor } from '../game/palette';
import type { PickupKind } from '../score/Score';

export class SpPickup extends Pickup {
  readonly kind: PickupKind = 'SP';
  readonly color: PaletteColor = Palette.sp;

  protected drawGlyph(ctx: CanvasRenderingContext2D): void {
    const r = 5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
}
