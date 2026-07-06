/**
 * Boot sequence progression — the pure state machine behind the Console's
 * boot screen (ADR 0002: the Console is styled as a boot-up terminal). It owns
 * the fake power-on text that types itself out line by line before the menu
 * appears. Canvas-free and deterministic (advanced by `dt`), so the typing feel
 * is unit-testable without a render layer.
 *
 * The sequence is skippable: any key jumps straight to "done" (the ConsoleRoom
 * wires that to `Input.pressed`). After a Run, the Console returns straight to
 * the menu without replaying the boot, so this only runs once per page load.
 */

export const BOOT_LINES: readonly string[] = [
  'BYTEPATH OS v2.0',
  'MEM CHECK ... 640K OK',
  'LOADING KERNEL ...',
  'MOUNT /skilltree ... OK',
  'MOUNT /save ... OK',
  'INIT CONSOLE ...',
  'READY.',
];

/** Seconds between each fully-revealed character. Tuned for a brisk teletype feel. */
export const CHAR_INTERVAL = 0.028;

/** Extra pause (seconds) held at the end of each completed line. */
export const LINE_PAUSE = 0.18;

export interface BootView {
  completedLines: readonly string[];
  /** The partially-revealed current line (empty once every line is done). */
  currentLine: string;
  done: boolean;
}

/**
 * Drives the teletype reveal. All timing lives here so the ConsoleRoom only has
 * to call `update(dt)` and read `view()`.
 */
export class BootSequence {
  private elapsed = 0;
  private lineIndex = 0;
  /** Characters revealed on the current line. */
  private charCount = 0;
  /** Seconds we linger after the current line is fully revealed. */
  private lineHold = 0;
  private finished = false;

  get done(): boolean {
    return this.finished;
  }

  update(dt: number): void {
    if (this.finished) return;
    this.elapsed += dt;

    // Reveal whole characters as enough time accrues; roll into the next line
    // after a short hold at each line's end.
    while (this.elapsed >= CHAR_INTERVAL) {
      const line = BOOT_LINES[this.lineIndex];
      if (line === undefined) {
        this.finished = true;
        return;
      }

      if (this.charCount < line.length) {
        this.elapsed -= CHAR_INTERVAL;
        this.charCount += 1;
        continue;
      }

      // Line fully revealed: hold briefly, then advance to the next line.
      this.lineHold += CHAR_INTERVAL;
      this.elapsed -= CHAR_INTERVAL;
      if (this.lineHold >= LINE_PAUSE) {
        this.lineHold = 0;
        this.lineIndex += 1;
        this.charCount = 0;
        if (this.lineIndex >= BOOT_LINES.length) {
          this.finished = true;
          return;
        }
      }
    }
  }

  skip(): void {
    this.finished = true;
  }

  view(): BootView {
    if (this.finished) {
      return { completedLines: BOOT_LINES, currentLine: '', done: true };
    }
    const completedLines = BOOT_LINES.slice(0, this.lineIndex);
    const line = BOOT_LINES[this.lineIndex] ?? '';
    return {
      completedLines,
      currentLine: line.slice(0, this.charCount),
      done: false,
    };
  }
}
