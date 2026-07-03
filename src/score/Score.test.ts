import { describe, it, expect } from 'vitest';
import { Score, SURVIVAL_RATE, PICKUP_BONUS } from './Score';

describe('Score', () => {
  it('starts at zero', () => {
    expect(new Score().value).toBe(0);
  });

  it('adds enemy kill values', () => {
    const s = new Score();
    s.addKill(100);
    s.addKill(150);
    expect(s.value).toBe(250);
  });

  it('adds pickup bonuses by kind', () => {
    const s = new Score();
    s.addPickup('Ammo');
    s.addPickup('Boost');
    s.addPickup('Attack');
    expect(s.value).toBe(PICKUP_BONUS.Ammo + PICKUP_BONUS.Boost + PICKUP_BONUS.Attack);
  });

  it('accrues survival points over time', () => {
    const s = new Score();
    // Feed just past a whole second via small dts; fractional accumulation must
    // reach at least one whole survival point.
    for (let i = 0; i < 61; i++) s.addSurvival(1 / 60);
    expect(s.value).toBe(SURVIVAL_RATE); // ~1 second => SURVIVAL_RATE points
  });

  it('floors fractional survival but keeps the remainder', () => {
    const s = new Score();
    s.addSurvival(0.4);
    expect(s.value).toBe(0);
    s.addSurvival(0.7); // total 1.1s
    expect(s.value).toBe(1);
  });

  it('combines all three sources', () => {
    const s = new Score();
    s.addKill(100);
    s.addPickup('Attack'); // 150
    s.addSurvival(2); // 2 whole seconds => 2 survival points
    expect(s.value).toBe(100 + 150 + 2);
  });
});
