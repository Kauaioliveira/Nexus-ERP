'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { optionalNumber, optionalText, text, toActionError } from '@/lib/form';
import type { ActionState } from '@/lib/types';

export async function updateCompanySettingsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const cscToken = optionalText(formData, 'cscToken');
  const body = {
    legalName: text(formData, 'legalName'),
    tradeName: optionalText(formData, 'tradeName') ?? null,
    cnpj: text(formData, 'cnpj').replace(/\D/g, ''),
    stateRegistration: text(formData, 'stateRegistration').replace(/\D/g, ''),
    taxRegime: optionalNumber(formData, 'taxRegime'),
    zipCode: text(formData, 'zipCode').replace(/\D/g, ''),
    street: text(formData, 'street'),
    number: text(formData, 'number') || 'S/N',
    district: text(formData, 'district'),
    city: text(formData, 'city'),
    cityCode: text(formData, 'cityCode'),
    state: text(formData, 'state'),
    phone: optionalText(formData, 'phone')?.replace(/\D/g, '') ?? null,
    nfeSeries: optionalNumber(formData, 'nfeSeries'),
    nfeNextNumber: optionalNumber(formData, 'nfeNextNumber'),
    nfceSeries: optionalNumber(formData, 'nfceSeries'),
    nfceNextNumber: optionalNumber(formData, 'nfceNextNumber'),
    cscId: text(formData, 'cscId'),
    // Campo em branco mantem o CSC atual (o valor nao e reexibido).
    ...(cscToken && { cscToken }),
    simulateSefazOffline: formData.get('simulateSefazOffline') === 'on',
  };

  try {
    await apiFetch('/company-settings', { method: 'PATCH', body: JSON.stringify(body) });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath('/dashboard/settings');
  return { success: 'Configurações salvas.' };
}
