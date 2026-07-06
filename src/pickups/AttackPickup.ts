/**
 * Carries a specific non-Neutral Attack chosen at spawn, and draws its glyph in
 * that Attack's color so the player can read what they're about to pick up.
 */
import { Pickup } from './Pickup';
import { ATTACKS, type AttackName } from '../combat/attacks';
import { randomChoice } from '../engine/mathutils';
import { ATTACK_PICKUP_CHOICES } from './pickupEffects';
import type { PaletteColor } from '../game/palette';
import type { PickupKind } from '../score/Score';

export class AttackPickup extends Pickup {
  readonly kind: PickupKind = 'Attack';
  readonly color: PaletteColor;
  /** The Attack this pickup grants (never Neutral). */
  readonly attackName: AttackName;

  constructor(x: number, y: number, attackName: AttackName = randomChoice(ATTACK_PICKUP_CHOICES)) {
    super(x, y);
    this.attackName = attackName;
    this.color = ATTACKS[attackName].color;
  }

  protected drawGlyph(ctx: CanvasRenderingContext2D): void {
    const r = 5;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.87, r * 0.5);
    ctx.lineTo(-r * 0.87, r * 0.5);
    ctx.closePath();
    ctx.stroke();
  }
}
