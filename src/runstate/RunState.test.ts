import { describe, it, expect } from 'vitest';
import {
  RunState,
  DEATH_BEAT_DURATION,
  LAST_RUN_HUD_DURATION,
} from './RunState';

const DT = 1 / 60;

function tickFor(rs: RunState, seconds: number): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) rs.update(DT);
}

describe('RunState', () => {
  it('starts playing with no last-run score', () => {
    const rs = new RunState();
    expect(rs.isPlaying).toBe(true);
    expect(rs.isDying).toBe(false);
    expect(rs.lastRunScore).toBeNull();
    expect(rs.showLastRun).toBe(false);
  });

  it('enters the dying phase on death and records the final score', () => {
    const rs = new RunState();
    rs.die(1234);
    expect(rs.isDying).toBe(true);
    expect(rs.isPlaying).toBe(false);
    expect(rs.lastRunScore).toBe(1234);
  });

  it('does not restart before the death beat elapses', () => {
    const rs = new RunState();
    rs.die(100);
    tickFor(rs, DEATH_BEAT_DURATION / 2);
    expect(rs.consumeRestart()).toBe(false);
    expect(rs.isDying).toBe(true);
  });

  it('restarts exactly once after the death beat', () => {
    const rs = new RunState();
    rs.die(100);
    tickFor(rs, DEATH_BEAT_DURATION + DT);
    expect(rs.consumeRestart()).toBe(true);
    expect(rs.isPlaying).toBe(true);
    // Only fires once.
    expect(rs.consumeRestart()).toBe(false);
  });

  it('ignores a second death report while already dying', () => {
    const rs = new RunState();
    rs.die(100);
    rs.die(999);
    expect(rs.lastRunScore).toBe(100);
  });

  it('resets the since-restart clock on restart', () => {
    const rs = new RunState();
    rs.die(100);
    tickFor(rs, DEATH_BEAT_DURATION + DT);
    rs.consumeRestart();
    expect(rs.sinceRestart).toBeCloseTo(0, 5);
  });

  it('shows the last-run line only for its window after a fresh start', () => {
    const rs = new RunState(500); // seeded from a prior Run
    expect(rs.showLastRun).toBe(true);
    tickFor(rs, LAST_RUN_HUD_DURATION + DT);
    expect(rs.showLastRun).toBe(false);
  });

  it('never shows the last-run line without a prior score', () => {
    const rs = new RunState();
    expect(rs.showLastRun).toBe(false);
  });
});
