import { addMonths, localDayStart, startOfLocalMonth, toDueDate, toLocalDay } from './dates';

describe('date utils', () => {
  it('normalizes due dates to noon UTC keeping the calendar day', () => {
    expect(toDueDate('2026-10-30').toISOString()).toBe('2026-10-30T12:00:00.000Z');
  });

  it('adds months clamping to the last day of shorter months', () => {
    const jan31 = new Date('2026-01-31T12:00:00.000Z');
    expect(addMonths(jan31, 1).toISOString()).toBe('2026-02-28T12:00:00.000Z');
    expect(addMonths(jan31, 2).toISOString()).toBe('2026-03-31T12:00:00.000Z');
    expect(addMonths(new Date('2026-11-15T12:00:00.000Z'), 3).toISOString()).toBe(
      '2027-02-15T12:00:00.000Z',
    );
  });
});

describe('business day helpers (UTC-3)', () => {
  it('maps late-night UTC instants to the previous local day', () => {
    // 01:30 UTC do dia 01/10 ainda e 30/09 as 22:30 em Brasilia.
    expect(toLocalDay(new Date('2026-10-01T01:30:00Z'))).toBe('2026-09-30');
    expect(localDayStart('2026-10-01').toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(startOfLocalMonth(new Date('2026-10-01T01:30:00Z'))).toBe('2026-09-01');
  });
});
