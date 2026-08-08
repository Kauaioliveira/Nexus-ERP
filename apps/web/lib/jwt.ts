// Decodificacao "burra" (sem verificar assinatura) do payload de um JWT.
// So usada para decidir, no middleware, se vale a pena tentar renovar o
// access token antes de deixar a requisicao seguir - a API sempre valida
// a assinatura de verdade em cada chamada, entao isto nunca e um limite
// de seguranca, apenas uma otimizacao de UX.
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR';
  exp: number;
  iat: number;
}

export function decodeJwtPayload(token: string): AccessTokenPayload | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json =
      typeof atob === 'function'
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('utf8');

    return JSON.parse(json) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;

  const nowSeconds = Date.now() / 1000;
  return payload.exp - skewSeconds <= nowSeconds;
}
