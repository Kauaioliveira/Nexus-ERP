'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { ActionState, Product } from '@/lib/types';

function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  const str = typeof value === 'string' ? value.trim() : '';
  return str.length > 0 ? str : undefined;
}

function parseProductForm(formData: FormData) {
  return {
    sku: String(formData.get('sku') ?? '').trim(),
    barcode: emptyToUndefined(formData.get('barcode')),
    name: String(formData.get('name') ?? '').trim(),
    description: emptyToUndefined(formData.get('description')),
    unit: emptyToUndefined(formData.get('unit')) ?? 'UN',
    costPrice: Number(formData.get('costPrice')),
    salePrice: Number(formData.get('salePrice')),
    minStock: formData.get('minStock') ? Number(formData.get('minStock')) : undefined,
    categoryId: emptyToUndefined(formData.get('categoryId')),
    supplierId: emptyToUndefined(formData.get('supplierId')),
  };
}

export async function createProductAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let createdId: string;

  try {
    const product = await apiFetch<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(parseProductForm(formData)),
    });
    createdId = product.id;
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }

  revalidatePath('/dashboard/products');
  redirect(`/dashboard/products/${createdId}`);
}

export async function updateProductAction(
  productId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await apiFetch<Product>(`/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(parseProductForm(formData)),
    });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }

  revalidatePath('/dashboard/products');
  revalidatePath(`/dashboard/products/${productId}`);
  return { error: undefined };
}

export async function deactivateProductAction(productId: string): Promise<void> {
  await apiFetch(`/products/${productId}`, { method: 'DELETE' });
  revalidatePath('/dashboard/products');
  redirect('/dashboard/products');
}

export interface ScannedProduct {
  id: string;
  name: string;
  sku: string;
}

// Chamada diretamente pelo componente cliente do leitor de codigo (nao
// esta presa a um <form>): Server Actions podem ser invocadas como
// funcoes normais a partir de handlers de evento no client.
export async function lookupProductByCodeAction(code: string): Promise<ScannedProduct | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  try {
    const result = await apiFetch<{ items: ScannedProduct[] }>(
      `/products?search=${encodeURIComponent(trimmed)}&pageSize=1`,
    );
    const product = result.items[0];
    return product ? { id: product.id, name: product.name, sku: product.sku } : null;
  } catch {
    return null;
  }
}
