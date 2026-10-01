'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { text, toActionError } from '@/lib/form';
import type {
  ActionState,
  Customer,
  PaginatedResponse,
  PaymentMethod,
  Product,
  SaleDetail,
} from '@/lib/types';

export interface PosProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  salePrice: number;
  costPrice: number;
  currentStock: number;
}

// Busca de produtos do PDV (nome, SKU ou codigo de barras). So ativos.
export async function searchProductsAction(term: string): Promise<PosProduct[]> {
  const search = term.trim();
  if (!search) return [];

  const result = await apiFetch<PaginatedResponse<Product>>(
    `/products?active=true&pageSize=8&search=${encodeURIComponent(search)}`,
  );

  return result.items.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    unit: product.unit,
    salePrice: Number(product.salePrice),
    costPrice: Number(product.costPrice),
    currentStock: product.currentStock,
  }));
}

export async function searchCustomersAction(
  term: string,
): Promise<Pick<Customer, 'id' | 'name' | 'document' | 'phone'>[]> {
  const search = term.trim();
  if (!search) return [];

  const result = await apiFetch<PaginatedResponse<Customer>>(
    `/customers?active=true&pageSize=8&search=${encodeURIComponent(search)}`,
  );

  return result.items.map(({ id, name, document, phone }) => ({ id, name, document, phone }));
}

export interface CreateSaleInput {
  items: { productId: string; quantity: number }[];
  customerId?: string;
  paymentMethod: PaymentMethod;
  discount?: number;
  installments?: number;
  firstDueDate?: string;
  notes?: string;
}

export async function createSaleAction(input: CreateSaleInput): Promise<ActionState> {
  let saleId: string;

  try {
    const sale = await apiFetch<SaleDetail>('/sales', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    saleId = sale.id;
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/sales');
  redirect(`/dashboard/sales/${saleId}?nova=1`);
}

export async function cancelSaleAction(
  saleId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await apiFetch(`/sales/${saleId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: text(formData, 'reason') }),
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath('/dashboard/sales');
  revalidatePath(`/dashboard/sales/${saleId}`);
  return { success: 'Venda cancelada. Estoque devolvido e financeiro ajustado.' };
}

export async function retryFiscalAction(saleId: string): Promise<void> {
  await apiFetch(`/sales/${saleId}/fiscal/retry`, { method: 'POST', body: '{}' });
  revalidatePath(`/dashboard/sales/${saleId}`);
}

