/**
 * Rooms are the game's screens (Stage, and later a title/game-over screen). A
 * Room owns its Area(s) and drives them. The RoomManager holds the single
 * active Room and swaps between them, destroying the outgoing one.
 *
 * This mirrors the LÖVE tutorial's room switching, minus the global room
 * registry — we keep it explicit.
 */
export interface Room {
  /** Advance the room by `dt` seconds. */
  update(dt: number): void;

  /** Draw the room. Only Rooms and GameObjects touch the canvas API. */
  draw(ctx: CanvasRenderingContext2D): void;

  /** Release everything the room owns (Areas, timers, listeners). */
  destroy(): void;
}

export class RoomManager {
  private current: Room | null = null;

  /** The active room, or null before the first `gotoRoom`. */
  get room(): Room | null {
    return this.current;
  }

  /** Destroy the current room (if any) and make `room` active. */
  gotoRoom(room: Room): void {
    this.current?.destroy();
    this.current = room;
  }

  update(dt: number): void {
    this.current?.update(dt);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.current?.draw(ctx);
  }
}
