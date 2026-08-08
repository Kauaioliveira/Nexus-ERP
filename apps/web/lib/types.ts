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

export interface StockMovement {
  id: string;
  type: MovementType;
  quantity: number;
  reason: string | null;
  createdAt: string;
  product: { id: string; sku: string; name: string };
}

export interface Sale {
  id: string;
  status: SaleStatus;
  total: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}
