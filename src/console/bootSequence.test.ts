import { describe, it, expect } from 'vitest';
import { BootSequence, BOOT_LINES, CHAR_INTERVAL, LINE_PAUSE } from './bootSequence';

/** Advance a sequence by `seconds` in small fixed steps, like the game loop. */
function run(seq: BootSequence, seconds: number, step = CHAR_INTERVAL / 4): void {
  let t = 0;
  while (t < seconds) {
    seq.update(step);
    t += step;
  }
}

describe('BootSequence', () => {
  it('starts empty and not done', () => {
    const seq = new BootSequence();
    const view = seq.view();
    expect(seq.done).toBe(false);
    expect(view.done).toBe(false);
    expect(view.completedLines).toEqual([]);
    expect(view.currentLine).toBe('');
  });

  it('reveals the first line character by character', () => {
    const seq = new BootSequence();
    seq.update(CHAR_INTERVAL);
    expect(seq.view().currentLine).toBe(BOOT_LINES[0]!.slice(0, 1));
    seq.update(CHAR_INTERVAL);
    expect(seq.view().currentLine).toBe(BOOT_LINES[0]!.slice(0, 2));
  });

  it('moves a fully-typed line into completedLines after the line pause', () => {
    const seq = new BootSequence();
    const firstLen = BOOT_LINES[0]!.length;
    // Type the whole first line plus its end-of-line hold.
    run(seq, CHAR_INTERVAL * firstLen + LINE_PAUSE + CHAR_INTERVAL);
    const view = seq.view();
    expect(view.completedLines[0]).toBe(BOOT_LINES[0]);
  });

  it('finishes after enough time and reports every line', () => {
    const seq = new BootSequence();
    const totalChars = BOOT_LINES.reduce((n, l) => n + l.length, 0);
    // Generous upper bound: all chars + a pause per line + slack.
    run(seq, CHAR_INTERVAL * totalChars + LINE_PAUSE * BOOT_LINES.length + 1);
    expect(seq.done).toBe(true);
    const view = seq.view();
    expect(view.done).toBe(true);
    expect(view.completedLines).toEqual(BOOT_LINES);
    expect(view.currentLine).toBe('');
  });

  it('skip() jumps straight to done', () => {
    const seq = new BootSequence();
    seq.update(CHAR_INTERVAL);
    seq.skip();
    expect(seq.done).toBe(true);
    expect(seq.view().completedLines).toEqual(BOOT_LINES);
  });

  it('is a no-op once done', () => {
    const seq = new BootSequence();
    seq.skip();
    seq.update(10);
    expect(seq.done).toBe(true);
    expect(seq.view().completedLines).toEqual(BOOT_LINES);
  });
});
