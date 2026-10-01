import { ApiError } from './api';
import type { ActionState } from './types';

// Helpers para ler FormData nas Server Actions.
export function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function optionalText(formData: FormData, key: string): string | undefined {
  const value = text(formData, key);
  return value.length > 0 ? value : undefined;
}

export function optionalNumber(formData: FormData, key: string): number | undefined {
  const value = text(formData, key).replace(',', '.');
  if (value.length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Converte erros da API em estado de formulario; qualquer outro erro
// (inclusive o redirect() do Next) segue adiante.
export function toActionError(error: unknown): ActionState {
  if (error instanceof ApiError) return { error: error.message };
  throw error;
}
