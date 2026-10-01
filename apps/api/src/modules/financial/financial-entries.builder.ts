import { FinancialEntryStatus, FinancialEntryType, PaymentMethod, Prisma } from '@prisma/client';
import { addMonths, toDueDate } from '../../common/utils/dates';
import { fromCents, splitInstallments } from '../../common/utils/money';

// Formas de pagamento em que o dinheiro entra na hora (ou e garantido pela
// operadora, no caso do cartao): a venda ja gera o recebimento quitado.
export const IMMEDIATE_PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.DINHEIRO,
  PaymentMethod.PIX,
  PaymentMethod.CARTAO_DEBITO,
  PaymentMethod.CARTAO_CREDITO,
];

export function isImmediatePayment(method: PaymentMethod): boolean {
  return IMMEDIATE_PAYMENT_METHODS.includes(method);
}

export interface InstallmentPlanInput {
  type: FinancialEntryType;
  description: string;
  totalCents: number;
  installments: number;
  firstDueDate: Date;
  userId: string;
  category?: string;
  notes?: string;
  paymentMethod?: PaymentMethod;
  // Quando informado, todas as parcelas ja nascem quitadas nesta data.
  paidAt?: Date;
  saleId?: string;
  purchaseOrderId?: string;
  customerId?: string | null;
  supplierId?: string | null;
}

// Monta os lancamentos de um parcelamento: N parcelas mensais a partir do
// primeiro vencimento, com a soma exata do total (arredondamento na 1a).
export function buildInstallmentEntries(
  input: InstallmentPlanInput,
): Prisma.FinancialEntryCreateManyInput[] {
  const amounts = splitInstallments(input.totalCents, input.installments);
  const firstDueDate = toDueDate(input.firstDueDate);

  return amounts.map((cents, index) => ({
    type: input.type,
    status: input.paidAt ? FinancialEntryStatus.PAID : FinancialEntryStatus.OPEN,
    description:
      input.installments > 1
        ? `${input.description} (${index + 1}/${input.installments})`
        : input.description,
    category: input.category,
    notes: input.notes,
    amount: fromCents(cents),
    dueDate: addMonths(firstDueDate, index),
    paidAt: input.paidAt ?? null,
    paymentMethod: input.paymentMethod ?? null,
    installment: index + 1,
    installments: input.installments,
    saleId: input.saleId,
    purchaseOrderId: input.purchaseOrderId,
    customerId: input.customerId ?? null,
    supplierId: input.supplierId ?? null,
    userId: input.userId,
  }));
}
