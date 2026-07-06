import { Pickup } from './Pickup';
import { Palette, type PaletteColor } from '../game/palette';
import type { PickupKind } from '../score/Score';

export class BoostPickup extends Pickup {
  readonly kind: PickupKind = 'Boost';
  readonly color: PaletteColor = Palette.boost;

  protected drawGlyph(ctx: CanvasRenderingContext2D): void {
    const r = 5;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.stroke();
  }
}
