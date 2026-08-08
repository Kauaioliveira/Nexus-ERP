export const ACCESS_TOKEN_COOKIE = 'nexus_at';
export const REFRESH_TOKEN_COOKIE = 'nexus_rt';

// httpOnly: os tokens nunca ficam acessiveis via JavaScript no navegador
// (protege contra roubo de token via XSS). sameSite=lax evita envio em
// requisicoes cross-site. secure e ligado fora de desenvolvimento.
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};
