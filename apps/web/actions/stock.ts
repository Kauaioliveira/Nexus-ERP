'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { optionalNumber, optionalText, text, toActionError } from '@/lib/form';
import type { ActionState } from '@/lib/types';

export async function createMovementAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const type = text(formData, 'type');
  const quantity = Math.trunc(optionalNumber(formData, 'quantity') ?? 0);

  try {
    await apiFetch('/stock-movements', {
      method: 'POST',
      body: JSON.stringify({
        productId: text(formData, 'productId'),
        type,
        // No ajuste, "reduzir" vira delta negativo.
        quantity: type === 'AJUSTE' && formData.get('direction') === 'down' ? -quantity : quantity,
        reason: optionalText(formData, 'reason'),
        unitCost: optionalNumber(formData, 'unitCost'),
      }),
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath('/dashboard/stock');
  revalidatePath('/dashboard/products');
  return { success: 'Movimentação registrada.' };
}
