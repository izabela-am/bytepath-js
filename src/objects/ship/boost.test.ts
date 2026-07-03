import { describe, it, expect } from 'vitest';
import {
  createBoostState,
  updateBoost,
  canBoost,
  BOOST_MAX,
  BOOST_DRAIN_RATE,
  BOOST_REGEN_RATE,
  BOOST_COOLDOWN,
} from './boost';

/** Advance the state by `total` seconds in `steps` equal ticks. */
function advance(state: ReturnType<typeof createBoostState>, total: number, steps: number, requesting: boolean): void {
  const dt = total / steps;
  for (let i = 0; i < steps; i += 1) updateBoost(state, dt, requesting);
}

describe('createBoostState', () => {
  it('starts full with no cooldown', () => {
    const state = createBoostState();
    expect(state.current).toBe(BOOST_MAX);
    expect(state.cooldown).toBe(0);
    expect(canBoost(state)).toBe(true);
  });
});

describe('updateBoost drain', () => {
  it('drains at BOOST_DRAIN_RATE per second while boosting', () => {
    const state = createBoostState();
    advance(state, 1, 60, true);
    expect(state.current).toBeCloseTo(BOOST_MAX - BOOST_DRAIN_RATE, 5);
  });

  it('returns true when Boost is actually spent', () => {
    const state = createBoostState();
    expect(updateBoost(state, 1 / 60, true)).toBe(true);
  });
});

describe('updateBoost regen', () => {
  it('regenerates at BOOST_REGEN_RATE per second while not boosting', () => {
    const state = createBoostState();
    state.current = 0;
    // Drop cooldown so we isolate regen behaviour.
    state.cooldown = 0;
    advance(state, 1, 60, false);
    expect(state.current).toBeCloseTo(BOOST_REGEN_RATE, 5);
  });

  it('clamps regen at BOOST_MAX', () => {
    const state = createBoostState();
    state.current = BOOST_MAX - 1;
    advance(state, 5, 60, false);
    expect(state.current).toBe(BOOST_MAX);
  });

  it('returns false when not boosting', () => {
    const state = createBoostState();
    expect(updateBoost(state, 1 / 60, false)).toBe(false);
  });
});

describe('depletion -> cooldown -> recovery', () => {
  it('enters cooldown on hitting zero', () => {
    const state = createBoostState();
    state.current = BOOST_DRAIN_RATE * (1 / 60) * 0.5; // less than one tick of drain
    updateBoost(state, 1 / 60, true);
    expect(state.current).toBe(0);
    expect(state.cooldown).toBeCloseTo(BOOST_COOLDOWN, 5);
    expect(canBoost(state)).toBe(false);
  });

  it('cannot boost during cooldown even while requesting', () => {
    const state = createBoostState();
    state.current = 30;
    state.cooldown = BOOST_COOLDOWN;
    const spent = updateBoost(state, 1 / 60, true);
    expect(spent).toBe(false);
    // Meter should have regenerated (not drained) during the cooldown tick.
    expect(state.current).toBeGreaterThan(30);
  });

  it('recovers boost ability once cooldown fully elapses', () => {
    const state = createBoostState();
    state.current = 0;
    state.cooldown = BOOST_COOLDOWN;
    // Not requesting: cooldown ticks down and meter regens.
    advance(state, BOOST_COOLDOWN, Math.round(BOOST_COOLDOWN * 60), false);
    expect(state.cooldown).toBe(0);
    expect(state.current).toBeGreaterThan(0);
    expect(canBoost(state)).toBe(true);
  });

  it('regen continues during cooldown', () => {
    const state = createBoostState();
    state.current = 0;
    state.cooldown = BOOST_COOLDOWN;
    updateBoost(state, 0.5, false);
    expect(state.current).toBeCloseTo(BOOST_REGEN_RATE * 0.5, 5);
    expect(state.cooldown).toBeCloseTo(BOOST_COOLDOWN - 0.5, 5);
  });
});

describe('createBoostState with modifiers', () => {
  it('defaults to the v1 constants (identity => v1 behavior)', () => {
    const state = createBoostState();
    expect(state.max).toBe(BOOST_MAX);
    expect(state.regenRate).toBe(BOOST_REGEN_RATE);
    expect(state.current).toBe(BOOST_MAX);
  });

  it('honors a raised maxBoost as ceiling and starting charge', () => {
    const state = createBoostState(150, BOOST_REGEN_RATE);
    expect(state.current).toBe(150);
    state.current = 140;
    // Regen clamps to the raised max, not the v1 BOOST_MAX.
    advance(state, 5, 60, false);
    expect(state.current).toBe(150);
  });

  it('regenerates at a modified boostRegen rate', () => {
    const state = createBoostState(BOOST_MAX, BOOST_REGEN_RATE * 2);
    state.current = 0;
    state.cooldown = 0;
    advance(state, 1, 60, false);
    expect(state.current).toBeCloseTo(BOOST_REGEN_RATE * 2, 5);
  });
});

describe('canBoost', () => {
  it('is false when meter is empty', () => {
    const state = createBoostState();
    state.current = 0;
    expect(canBoost(state)).toBe(false);
  });

  it('is false during cooldown', () => {
    const state = createBoostState();
    state.cooldown = 0.1;
    expect(canBoost(state)).toBe(false);
  });

  it('is true when meter has charge and no cooldown', () => {
    const state = createBoostState();
    state.current = 1;
    state.cooldown = 0;
    expect(canBoost(state)).toBe(true);
  });
});
