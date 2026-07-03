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

  it('awards the SP pickup bonus', () => {
    const s = new Score();
    s.addPickup('SP');
    expect(s.value).toBe(PICKUP_BONUS.SP);
  });
});

describe('Score scoreMultiplier', () => {
  it('leaves every source unchanged at multiplier 1 (identity => v1 behavior)', () => {
    const s = new Score(1);
    s.addKill(100);
    s.addPickup('Attack'); // 150
    s.addSurvival(3); // 3 survival points
    expect(s.value).toBe(100 + 150 + 3);
  });

  it('scales kills, pickups, and survival by a non-identity multiplier', () => {
    const s = new Score(2);
    s.addKill(100); // => 200
    s.addPickup('Ammo'); // 50 => 100
    s.addSurvival(4); // 4 => 8
    expect(s.value).toBe(200 + 100 + 8);
  });

  it('rounds scaled discrete points to whole numbers', () => {
    const s = new Score(1.5);
    s.addKill(101); // 151.5 => 152
    expect(s.value).toBe(152);
  });

  it('a smaller multiplier scales Score down', () => {
    const s = new Score(0.5);
    s.addKill(100); // => 50
    s.addSurvival(10); // 10 * 0.5 = 5
    expect(s.value).toBe(50 + 5);
  });
});
