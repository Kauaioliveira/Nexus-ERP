'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { optionalText, text, toActionError } from '@/lib/form';
import type { ActionState } from '@/lib/types';

export async function createUserAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify({
        name: text(formData, 'name'),
        email: text(formData, 'email'),
        password: text(formData, 'password'),
        role: text(formData, 'role') || undefined,
      }),
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath('/dashboard/users');
  return { success: 'Usuário criado. Passe o e-mail e a senha inicial para a pessoa.' };
}

export async function updateUserAction(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await apiFetch(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        role: text(formData, 'role') || undefined,
        active: formData.get('active') === 'true',
        password: optionalText(formData, 'password'),
      }),
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath('/dashboard/users');
  return { success: 'Salvo.' };
}
