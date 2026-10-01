'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { optionalNumber, optionalText, toActionError } from '@/lib/form';
import type { ActionState, PurchaseOrderDetail } from '@/lib/types';

export interface CreatePurchaseInput {
  supplierId: string;
  items: { productId: string; quantity: number; unitCost: number }[];
  expectedAt?: string;
  notes?: string;
}

export async function createPurchaseOrderAction(input: CreatePurchaseInput): Promise<ActionState> {
  let id: string;
  try {
    const order = await apiFetch<PurchaseOrderDetail>('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    id = order.id;
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath('/dashboard/purchases');
  redirect(`/dashboard/purchases/${id}`);
}

export async function receivePurchaseOrderAction(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await apiFetch(`/purchase-orders/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify({
        installments: optionalNumber(formData, 'installments'),
        firstDueDate: optionalText(formData, 'firstDueDate'),
      }),
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath('/dashboard/purchases');
  revalidatePath(`/dashboard/purchases/${id}`);
  revalidatePath('/dashboard/products');
  return { success: 'Mercadoria recebida: estoque atualizado e contas a pagar geradas.' };
}

export async function cancelPurchaseOrderAction(id: string): Promise<void> {
  await apiFetch(`/purchase-orders/${id}/cancel`, { method: 'POST', body: '{}' });
  revalidatePath('/dashboard/purchases');
  revalidatePath(`/dashboard/purchases/${id}`);
}
