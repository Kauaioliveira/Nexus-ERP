import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { PaginatedResponse, Product } from '@/lib/types';

export default async function DashboardOverviewPage() {
  const [productsPage, lowStock] = await Promise.all([
    apiFetch<PaginatedResponse<Product>>('/products?pageSize=1'),
    apiFetch<Product[]>('/products/low-stock'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Visao geral</h1>
        <p className="text-sm text-slate-500">
          Resumo rapido do estoque. Graficos completos chegam na proxima etapa.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard label="Produtos cadastrados" value={productsPage.total} href="/dashboard/products" />
        <SummaryCard
          label="Produtos com estoque baixo"
          value={lowStock.length}
          href="/dashboard/products"
          tone={lowStock.length > 0 ? 'warning' : 'default'}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  href,
  tone = 'default',
}: {
  label: string;
  value: number;
  href: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <Link
      href={href}
      className={`block rounded-xl border p-5 shadow-sm transition hover:shadow ${
        tone === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'
      }`}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
    </Link>
  );
}
