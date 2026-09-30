import { fromCents, splitInstallments, toCents } from './money';

describe('money utils', () => {
  it('converts to and from cents without floating point drift', () => {
    expect(toCents('0.1') + toCents('0.2')).toBe(30);
    expect(fromCents(toCents(19.99) * 3)).toBe(59.97);
  });

  it('splits installments so the sum always matches the total', () => {
    expect(splitInstallments(10_000, 3)).toEqual([3_334, 3_333, 3_333]);
    expect(splitInstallments(5_000, 1)).toEqual([5_000]);
    expect(splitInstallments(10, 4).reduce((a, b) => a + b, 0)).toBe(10);
  });
});
