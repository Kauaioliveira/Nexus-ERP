export type Role = 'ADMIN' | 'OPERATOR';

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

export interface CustomerDetail extends Customer {
  stats: { salesCount: number; salesTotal: string | number; openBalance: string | number };
  recentSales: Pick<Sale, 'id' | 'number' | 'status' | 'total' | 'paymentMethod' | 'createdAt'>[];
}

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  unit: string;
  costPrice: string;
  salePrice: string;
  minStock: number;
  currentStock: number;
  active: boolean;
  categoryId: string | null;
  category?: Category | null;
  supplierId: string | null;
  supplier?: Supplier | null;
}

export type MovementType = 'ENTRADA' | 'SAIDA' | 'AJUSTE';
export type SaleStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type PaymentMethod =
  | 'DINHEIRO'
  | 'PIX'
  | 'CARTAO_DEBITO'
  | 'CARTAO_CREDITO'
  | 'BOLETO'
  | 'A_PRAZO';
export type PurchaseOrderStatus = 'ORDERED' | 'RECEIVED' | 'CANCELLED';
export type FinancialEntryType = 'RECEIVABLE' | 'PAYABLE';
export type FinancialEntryStatus = 'OPEN' | 'PAID' | 'CANCELLED';
export type FiscalStatus = 'NOT_REQUESTED' | 'QUEUED' | 'PROCESSING' | 'ISSUED' | 'FAILED';

export interface StockMovement {
  id: string;
  type: MovementType;
  quantity: number;
  reason: string | null;
  unitCost: string | null;
  createdAt: string;
  product: { id: string; sku: string; name: string };
  user?: { id: string; name: string };
}

export interface FinancialEntry {
  id: string;
  type: FinancialEntryType;
  status: FinancialEntryStatus;
  description: string;
  category: string | null;
  amount: string;
  dueDate: string;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  installment: number;
  installments: number;
  notes: string | null;
  customer?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  sale?: { id: string; number: number } | null;
  purchaseOrder?: { id: string; number: number } | null;
}

export interface FiscalDocument {
  status: FiscalStatus;
  provider: string;
  externalId: string | null;
  pdfUrl: string | null;
  xmlUrl: string | null;
  errorMessage: string | null;
}

export interface Sale {
  id: string;
  number: number;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  subtotal: string;
  discount: string;
  total: string;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  customer?: { id: string; name: string; document?: string | null } | null;
  user?: { id: string; name: string };
  fiscalDocument?: FiscalDocument | null;
  _count?: { items: number };
}

export interface SaleDetail extends Sale {
  items: {
    id: string;
    quantity: number;
    unitPrice: string;
    unitCost: string;
    product: { id: string; sku: string; name: string; unit: string };
  }[];
  financialEntries: FinancialEntry[];
}

export interface PurchaseOrder {
  id: string;
  number: number;
  status: PurchaseOrderStatus;
  total: string;
  expectedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  createdAt: string;
  supplier: { id: string; name: string; document?: string | null };
  _count?: { items: number };
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  user: { id: string; name: string };
  items: {
    id: string;
    quantity: number;
    unitCost: string;
    product: { id: string; sku: string; name: string; unit: string; currentStock: number };
  }[];
  financialEntries: FinancialEntry[];
}

export interface CountAndTotal {
  total: number;
  count: number;
}

export interface FinancialSummary {
  period: { from: string; to: string };
  cashFlow: {
    received: number;
    paid: number;
    balance: number;
    daily: { date: string; received: number; paid: number }[];
  };
  receivables: { open: CountAndTotal; overdue: CountAndTotal; next7Days: CountAndTotal };
  payables: { open: CountAndTotal; overdue: CountAndTotal; next7Days: CountAndTotal };
}

export interface Overview {
  period: { from: string; to: string };
  today: { count: number; total: number };
  sales: {
    count: number;
    revenue: number;
    discount: number;
    averageTicket: number;
    cost?: number;
    grossProfit?: number;
    grossMargin?: number;
  };
  salesByDay: { date: string; total: number; count: number }[];
  topProducts: { productId: string; name: string; sku: string; quantity: number; revenue: number }[];
  paymentMethods: { paymentMethod: PaymentMethod; count: number; total: number }[];
  stock: { activeProducts: number; lowStock: number; saleValue: number; costValue?: number };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActionState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
}
