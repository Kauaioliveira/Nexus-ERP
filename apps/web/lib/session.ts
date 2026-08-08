import { cookies } from 'next/headers';
import { apiFetch, ApiError } from './api';
import { ACCESS_TOKEN_COOKIE } from './constants';
import { SafeUser } from './types';

export function hasSession(): boolean {
  return Boolean(cookies().get(ACCESS_TOKEN_COOKIE)?.value);
}

// Busca o usuario logado direto na API (garante que o token ainda e
// valido do lado do servidor, nao so que o cookie existe).
export async function getCurrentUser(): Promise<SafeUser | null> {
  if (!hasSession()) return null;

  try {
    return await apiFetch<SafeUser>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}
