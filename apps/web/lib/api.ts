import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE } from './constants';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Cliente HTTP para uso em Server Components e Server Actions. Le o
// access token do cookie httpOnly e o envia como Bearer token para a API
// NestJS. A renovacao do token (quando expirado) e responsabilidade do
// middleware, que roda antes de qualquer Server Component ser renderizado
// - por isso este helper nao tenta fazer refresh sozinho.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = cookies().get(ACCESS_TOKEN_COOKIE)?.value;

  const response = await fetch(`${process.env.API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    let message = `Erro ${response.status} ao chamar a API.`;

    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        message = body.message.join(' ');
      } else if (typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // corpo nao era JSON valido - mantem a mensagem generica
    }

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
