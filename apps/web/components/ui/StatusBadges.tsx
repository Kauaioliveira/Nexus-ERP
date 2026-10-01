import {
  ENTRY_STATUS_LABELS,
  FISCAL_STATUS_LABELS,
  PURCHASE_STATUS_LABELS,
  SALE_STATUS_LABELS,
  isOverdue,
} from '@/lib/format';
import type {
  FinancialEntryStatus,
  FiscalStatus,
  PurchaseOrderStatus,
  SaleStatus,
} from '@/lib/types';
import { Badge, type BadgeTone } from './Badge';

const SALE_TONES: Record<SaleStatus, BadgeTone> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const PURCHASE_TONES: Record<PurchaseOrderStatus, BadgeTone> = {
  ORDERED: 'info',
  RECEIVED: 'success',
  CANCELLED: 'neutral',
};

const FISCAL_TONES: Record<FiscalStatus, BadgeTone> = {
  NOT_REQUESTED: 'neutral',
  QUEUED: 'info',
  PROCESSING: 'info',
  ISSUED: 'success',
  FAILED: 'danger',
};

export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  return <Badge tone={SALE_TONES[status]}>{SALE_STATUS_LABELS[status]}</Badge>;
}

export function PurchaseStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return <Badge tone={PURCHASE_TONES[status]}>{PURCHASE_STATUS_LABELS[status]}</Badge>;
}

export function FiscalStatusBadge({ status }: { status: FiscalStatus }) {
  return <Badge tone={FISCAL_TONES[status]}>NF-e: {FISCAL_STATUS_LABELS[status]}</Badge>;
}

export function EntryStatusBadge({
  entry,
}: {
  entry: { status: FinancialEntryStatus; dueDate: string };
}) {
  if (isOverdue(entry)) return <Badge tone="danger">Vencido</Badge>;
  const tone: BadgeTone =
    entry.status === 'PAID' ? 'success' : entry.status === 'OPEN' ? 'warning' : 'neutral';
  return <Badge tone={tone}>{ENTRY_STATUS_LABELS[entry.status]}</Badge>;
}
