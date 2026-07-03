/**
 * Keyboard state tracker.
 *
 * `isDown(key)` reports whether a key is currently held. `pressed(key)` reports
 * whether a key transitioned to down since the last frame — the edge is
 * consumed by `endFrame()`, which the loop calls once after each update tick, so
 * a single press fires exactly once regardless of frame rate.
 *
 * Keys are the browser `KeyboardEvent.code` values (e.g. "ArrowLeft", "KeyZ",
 * "Space") so layout is physical, not locale-dependent.
 */
export class Input {
  private down = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;
  private target: Window | HTMLElement;

  constructor(target: Window | HTMLElement = window) {
    this.target = target;
    this.handleKeyDown = (e: KeyboardEvent): void => {
      // Ignore auto-repeat so `pressed` stays a true edge.
      if (e.repeat) return;
      if (!this.down.has(e.code)) {
        this.pressedThisFrame.add(e.code);
      }
      this.down.add(e.code);
    };
    this.handleKeyUp = (e: KeyboardEvent): void => {
      this.down.delete(e.code);
    };
    this.target.addEventListener('keydown', this.handleKeyDown as EventListener);
    this.target.addEventListener('keyup', this.handleKeyUp as EventListener);
  }

  /** True while `code` is held. */
  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True on the frame `code` went from up to down; cleared by `endFrame`. */
  pressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  /** True if any of the given codes is currently held. */
  anyDown(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  /** Consume this frame's press edges. Call once per update tick. */
  endFrame(): void {
    this.pressedThisFrame.clear();
  }

  /** Detach listeners. */
  destroy(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.handleKeyUp as EventListener);
    this.down.clear();
    this.pressedThisFrame.clear();
  }
}
