import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE } from '@/lib/constants';

// Baixa o XML autorizado (ou o do cancelamento, com ?tipo=cancelamento)
// repassando o token do cookie httpOnly para a API.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const kind = new URL(request.url).searchParams.get('tipo') === 'cancelamento' ? 'cancel-xml' : 'xml';
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return NextResponse.redirect(new URL('/login', request.url));

  const response = await fetch(`${process.env.API_URL}/sales/${encodeURIComponent(id)}/fiscal/${kind}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    return new NextResponse('XML indisponível para esta venda.', { status: response.status });
  }

  return new NextResponse(await response.text(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': response.headers.get('content-disposition') ?? 'attachment; filename="nota.xml"',
    },
  });
}
