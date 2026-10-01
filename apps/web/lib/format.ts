import type {
  FinancialEntryStatus,
  FinancialEntryType,
  FiscalStatus,
  MovementType,
  PaymentMethod,
  PurchaseOrderStatus,
  SaleStatus,
} from './types';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatMoney(value: number | string | null | undefined): string {
  return currency.format(Number(value ?? 0));
}

// Vencimentos sao gravados ao meio-dia UTC (so o dia importa): formata em
// UTC para o dia nunca "voltar" por causa do fuso.
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

// Instantes (hora da venda, da baixa) sao exibidos no horario de Brasilia.
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

// Dia de hoje (AAAA-MM-DD) no fuso de Brasilia, para valores padrao de
// campos de data.
export function todayInput(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  CARTAO_DEBITO: 'Cartão de débito',
  CARTAO_CREDITO: 'Cartão de crédito',
  BOLETO: 'Boleto',
  A_PRAZO: 'A prazo (fiado)',
};

export const DEFERRED_PAYMENT_METHODS: PaymentMethod[] = ['BOLETO', 'A_PRAZO'];

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  PENDING: 'Pendente',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
};

export const PURCHASE_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  ORDERED: 'Aguardando entrega',
  RECEIVED: 'Recebido',
  CANCELLED: 'Cancelado',
};

export const ENTRY_TYPE_LABELS: Record<FinancialEntryType, string> = {
  RECEIVABLE: 'A receber',
  PAYABLE: 'A pagar',
};

export const ENTRY_STATUS_LABELS: Record<FinancialEntryStatus, string> = {
  OPEN: 'Em aberto',
  PAID: 'Quitado',
  CANCELLED: 'Cancelado',
};

export const FISCAL_STATUS_LABELS: Record<FiscalStatus, string> = {
  NOT_REQUESTED: 'Não emitida',
  QUEUED: 'Na fila',
  PROCESSING: 'Emitindo',
  ISSUED: 'Emitida',
  FAILED: 'Falhou',
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  AJUSTE: 'Ajuste',
};

// Um lancamento em aberto com vencimento anterior a hoje esta vencido.
export function isOverdue(entry: { status: FinancialEntryStatus; dueDate: string }): boolean {
  return entry.status === 'OPEN' && entry.dueDate.slice(0, 10) < todayInput();
}
