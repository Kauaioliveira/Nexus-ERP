'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { optionalNumber, optionalText, text, toActionError } from '@/lib/form';
import type { ActionState } from '@/lib/types';

function refresh() {
  revalidatePath('/dashboard/finance');
  revalidatePath('/dashboard');
}

export async function createEntryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const type = text(formData, 'type');
  try {
    await apiFetch('/financial-entries', {
      method: 'POST',
      body: JSON.stringify({
        type,
        description: text(formData, 'description'),
        amount: optionalNumber(formData, 'amount'),
        dueDate: text(formData, 'dueDate'),
        installments: optionalNumber(formData, 'installments'),
        category: optionalText(formData, 'category'),
        notes: optionalText(formData, 'notes'),
        paid: formData.get('paid') === 'on',
        paymentMethod: optionalText(formData, 'paymentMethod'),
      }),
    });
  } catch (error) {
    return toActionError(error);
  }

  refresh();
  redirect(`/dashboard/finance?type=${type}`);
}

// Acoes de linha (baixa, reabrir, cancelar): sem estado de formulario;
// erro da API vira a pagina de erro padrao.
export async function payEntryAction(id: string, formData: FormData): Promise<void> {
  await apiFetch(`/financial-entries/${id}/pay`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethod: optionalText(formData, 'paymentMethod') }),
  });
  refresh();
}

export async function reopenEntryAction(id: string): Promise<void> {
  await apiFetch(`/financial-entries/${id}/reopen`, { method: 'POST', body: '{}' });
  refresh();
}

export async function cancelEntryAction(id: string): Promise<void> {
  await apiFetch(`/financial-entries/${id}/cancel`, { method: 'POST', body: '{}' });
  refresh();
}
