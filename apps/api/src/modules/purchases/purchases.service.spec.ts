import { weightedAverageCost } from './purchases.service';

describe('weightedAverageCost', () => {
  it('averages the cost of what is in stock with what was received', () => {
    // 10 un a R$ 10,00 + 10 un a R$ 12,00 = 20 un a R$ 11,00
    expect(weightedAverageCost(10, 10, 10, 12)).toBe(11);
  });

  it('uses the purchase cost when there was nothing in stock', () => {
    expect(weightedAverageCost(0, 99, 5, 7.5)).toBe(7.5);
  });

  it('ignores negative balances when averaging', () => {
    expect(weightedAverageCost(-3, 10, 4, 8)).toBe(8);
  });

  it('rounds to cents', () => {
    expect(weightedAverageCost(1, 1, 2, 2)).toBe(1.67);
  });
});
