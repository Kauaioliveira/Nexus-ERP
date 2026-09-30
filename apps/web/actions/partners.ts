'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { optionalText, text, toActionError } from '@/lib/form';
import type { ActionState } from '@/lib/types';

// Clientes e fornecedores tem cadastro parecido; as actions sao
// parametrizadas pelo recurso da API.
type Resource = 'customers' | 'suppliers';

function parsePartnerForm(resource: Resource, formData: FormData, editing: boolean) {
  // Na edicao, campo vazio significa "apagar" (null); na criacao, omitir.
  const optional = (key: string) => optionalText(formData, key) ?? (editing ? null : undefined);
  return {
    name: text(formData, 'name'),
    document: optional('document'),
    email: optional('email'),
    phone: optional('phone'),
    ...(resource === 'customers' && {
      address: optional('address'),
      notes: optional('notes'),
    }),
  };
}

export async function createPartnerAction(
  resource: Resource,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let id: string;
  try {
    const created = await apiFetch<{ id: string }>(`/${resource}`, {
      method: 'POST',
      body: JSON.stringify(parsePartnerForm(resource, formData, false)),
    });
    id = created.id;
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/dashboard/${resource}`);
  redirect(`/dashboard/${resource}/${id}`);
}

export async function updatePartnerAction(
  resource: Resource,
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await apiFetch(`/${resource}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(parsePartnerForm(resource, formData, true)),
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/dashboard/${resource}`);
  revalidatePath(`/dashboard/${resource}/${id}`);
  return { success: 'Alterações salvas.' };
}

export async function setPartnerActiveAction(
  resource: Resource,
  id: string,
  active: boolean,
): Promise<void> {
  if (active) {
    await apiFetch(`/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) });
  } else {
    await apiFetch(`/${resource}/${id}`, { method: 'DELETE' });
  }
  revalidatePath(`/dashboard/${resource}`);
  revalidatePath(`/dashboard/${resource}/${id}`);
}
