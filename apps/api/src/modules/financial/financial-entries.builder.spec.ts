import { FinancialEntryStatus, FinancialEntryType, PaymentMethod } from '@prisma/client';
import { buildInstallmentEntries, isImmediatePayment } from './financial-entries.builder';

describe('buildInstallmentEntries', () => {
  const base = {
    type: FinancialEntryType.PAYABLE,
    description: 'Pedido de compra #7',
    totalCents: 100_000,
    firstDueDate: new Date('2026-01-31T12:00:00Z'),
    userId: 'user-1',
  };

  it('creates monthly open installments numbered in the description', () => {
    const entries = buildInstallmentEntries({ ...base, installments: 3 });

    expect(entries.map((e) => e.amount)).toEqual([333.34, 333.33, 333.33]);
    expect(entries.map((e) => e.description)).toEqual([
      'Pedido de compra #7 (1/3)',
      'Pedido de compra #7 (2/3)',
      'Pedido de compra #7 (3/3)',
    ]);
    expect(entries.map((e) => (e.dueDate as Date).toISOString().slice(0, 10))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
    expect(entries.every((e) => e.status === FinancialEntryStatus.OPEN && !e.paidAt)).toBe(true);
  });

  it('creates already-paid entries when paidAt is given', () => {
    const paidAt = new Date();
    const [entry] = buildInstallmentEntries({ ...base, installments: 1, paidAt });

    expect(entry.status).toBe(FinancialEntryStatus.PAID);
    expect(entry.paidAt).toBe(paidAt);
    expect(entry.description).toBe('Pedido de compra #7');
  });
});

describe('isImmediatePayment', () => {
  it('treats cash, PIX and cards as received on the spot', () => {
    expect(isImmediatePayment(PaymentMethod.PIX)).toBe(true);
    expect(isImmediatePayment(PaymentMethod.CARTAO_CREDITO)).toBe(true);
    expect(isImmediatePayment(PaymentMethod.BOLETO)).toBe(false);
    expect(isImmediatePayment(PaymentMethod.A_PRAZO)).toBe(false);
  });
});
