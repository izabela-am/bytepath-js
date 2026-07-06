/** Also drops from enemy kills; the Stage handles the collect effect. */
import { Pickup } from './Pickup';
import { Palette, type PaletteColor } from '../game/palette';
import type { PickupKind } from '../score/Score';

export class AmmoPickup extends Pickup {
  readonly kind: PickupKind = 'Ammo';
  readonly color: PaletteColor = Palette.ammo;

  protected drawGlyph(ctx: CanvasRenderingContext2D): void {
    const r = 4;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
  }
}
