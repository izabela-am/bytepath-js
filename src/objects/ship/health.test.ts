import { describe, it, expect } from 'vitest';
import {
  createHealthState,
  applyDamage,
  updateHealth,
  isInvulnerable,
  isDead,
  SHIP_MAX_HP,
  SHIP_INVULN_DURATION,
} from './health';

describe('ship health', () => {
  it('starts full and vulnerable', () => {
    const s = createHealthState();
    expect(s.current).toBe(SHIP_MAX_HP);
    expect(isInvulnerable(s)).toBe(false);
    expect(isDead(s)).toBe(false);
  });

  it('subtracts damage and opens the invulnerability window', () => {
    const s = createHealthState();
    const killed = applyDamage(s, 30);
    expect(killed).toBe(false);
    expect(s.current).toBe(SHIP_MAX_HP - 30);
    expect(isInvulnerable(s)).toBe(true);
    expect(s.invuln).toBeCloseTo(SHIP_INVULN_DURATION);
  });

  it('ignores damage while invulnerable', () => {
    const s = createHealthState();
    applyDamage(s, 30);
    const before = s.current;
    const killed = applyDamage(s, 30); // still invulnerable
    expect(killed).toBe(false);
    expect(s.current).toBe(before);
  });

  it('allows damage again after the window elapses', () => {
    const s = createHealthState();
    applyDamage(s, 30);
    // Tick the window down past its duration.
    for (let i = 0; i < 40; i++) updateHealth(s, 1 / 60);
    expect(isInvulnerable(s)).toBe(false);
    const killed = applyDamage(s, 30);
    expect(killed).toBe(false);
    expect(s.current).toBe(SHIP_MAX_HP - 60);
  });

  it('clamps HP at 0 and reports the killing blow once', () => {
    const s = createHealthState();
    s.current = 20;
    const killed = applyDamage(s, 30);
    expect(killed).toBe(true);
    expect(s.current).toBe(0);
    expect(isDead(s)).toBe(true);
  });

  it('ignores damage once dead', () => {
    const s = createHealthState();
    s.current = 20;
    applyDamage(s, 30);
    const killedAgain = applyDamage(s, 10);
    expect(killedAgain).toBe(false);
    expect(s.current).toBe(0);
  });

  it('does not let the invulnerability window go negative', () => {
    const s = createHealthState();
    applyDamage(s, 10);
    for (let i = 0; i < 100; i++) updateHealth(s, 1 / 60);
    expect(s.invuln).toBe(0);
  });

  it('defaults max to SHIP_MAX_HP (identity => v1 behavior)', () => {
    const s = createHealthState();
    expect(s.max).toBe(SHIP_MAX_HP);
    expect(s.current).toBe(SHIP_MAX_HP);
  });

  it('honors a raised maxHp as ceiling and starting HP', () => {
    const s = createHealthState(150);
    expect(s.max).toBe(150);
    expect(s.current).toBe(150);
    // Damage/death rules are unchanged by the higher ceiling.
    const killed = applyDamage(s, 30);
    expect(killed).toBe(false);
    expect(s.current).toBe(120);
  });
});
