'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_TOKEN_COOKIE, AUTH_COOKIE_OPTIONS, REFRESH_TOKEN_COOKIE } from '@/lib/constants';
import { ActionState } from '@/lib/types';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Informe e-mail e senha.' };
  }

  const response = await fetch(`${process.env.API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { message?: string });
    return {
      error:
        typeof body.message === 'string'
          ? body.message
          : 'Nao foi possivel entrar. Verifique suas credenciais.',
    };
  }

  const data = (await response.json()) as LoginResponse;

  cookies().set(ACCESS_TOKEN_COOKIE, data.accessToken, AUTH_COOKIE_OPTIONS);
  cookies().set(REFRESH_TOKEN_COOKIE, data.refreshToken, AUTH_COOKIE_OPTIONS);

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const refreshToken = cookies().get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    await fetch(`${process.env.API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    }).catch(() => undefined);
  }

  cookies().delete(ACCESS_TOKEN_COOKIE);
  cookies().delete(REFRESH_TOKEN_COOKIE);
  redirect('/login');
}
