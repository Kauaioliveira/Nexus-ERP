import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, AUTH_COOKIE_OPTIONS, REFRESH_TOKEN_COOKIE } from './lib/constants';
import { isTokenExpired } from './lib/jwt';

const PROTECTED_PREFIX = '/dashboard';

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

async function tryRefresh(refreshToken: string): Promise<RefreshResponse | null> {
  try {
    const res = await fetch(`${process.env.API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });

    if (!res.ok) return null;
    return (await res.json()) as RefreshResponse;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith(PROTECTED_PREFIX);
  const isLoginPage = pathname === '/login';

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!isProtected && !isLoginPage) {
    return NextResponse.next();
  }

  // Access token ausente ou perto de expirar: tenta renovar com o
  // refresh token antes de decidir se o usuario esta autenticado.
  let response = NextResponse.next();
  let effectiveAccessToken = accessToken;

  if ((!accessToken || isTokenExpired(accessToken)) && refreshToken) {
    const refreshed = await tryRefresh(refreshToken);

    if (refreshed) {
      effectiveAccessToken = refreshed.accessToken;
      response.cookies.set(ACCESS_TOKEN_COOKIE, refreshed.accessToken, AUTH_COOKIE_OPTIONS);
      response.cookies.set(REFRESH_TOKEN_COOKIE, refreshed.refreshToken, AUTH_COOKIE_OPTIONS);
    } else {
      effectiveAccessToken = undefined;
      response.cookies.delete(ACCESS_TOKEN_COOKIE);
      response.cookies.delete(REFRESH_TOKEN_COOKIE);
    }
  }

  const isAuthenticated = Boolean(effectiveAccessToken && !isTokenExpired(effectiveAccessToken));

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    response = NextResponse.redirect(loginUrl);
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
    return response;
  }

  if (isLoginPage && isAuthenticated) {
    response = NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
