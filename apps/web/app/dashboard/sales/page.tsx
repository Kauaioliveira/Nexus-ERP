import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PAYMENT_METHOD_LABELS, SALE_STATUS_LABELS, formatDateTime, formatMoney } from '@/lib/format';
import type { PaginatedResponse, Sale } from '@/lib/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { FiscalStatusBadge, SaleStatusBadge } from '@/components/ui/StatusBadges';

export const metadata: Metadata = { title: 'Vendas' };

interface SearchParams {
  search?: string;
  status?: string;
  paymentMethod?: string;
  from?: string;
  to?: string;
  page?: string;
}

export default async function SalesPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const page = Number(searchParams.page ?? '1') || 1;

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  for (const key of ['search', 'status', 'paymentMethod', 'from', 'to'] as const) {
    if (searchParams[key]) params.set(key, searchParams[key]);
  }

  const sales = await apiFetch<PaginatedResponse<Sale>>(`/sales?${params.toString()}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas"
        description={`${sales.total} venda(s) encontrada(s)`}
        actions={
          <Link href="/dashboard/sales/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            Nova venda
          </Link>
        }
      />

      <form method="GET" className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="search" className="label">
            Buscar
          </label>
          <input
            id="search"
            name="search"
            type="search"
            placeholder="Nº da venda ou nome do cliente"
            defaultValue={searchParams.search}
            className="input mt-1"
          />
        </div>
        <div>
          <label htmlFor="status" className="label">
            Situação
          </label>
          <select id="status" name="status" defaultValue={searchParams.status ?? ''} className="input mt-1">
            <option value="">Todas</option>
            {Object.entries(SALE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="paymentMethod" className="label">
            Pagamento
          </label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            defaultValue={searchParams.paymentMethod ?? ''}
            className="input mt-1"
          >
            <option value="">Todos</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="label">
            De
          </label>
          <input id="from" name="from" type="date" defaultValue={searchParams.from} className="input mt-1" />
        </div>
        <div>
          <label htmlFor="to" className="label">
            Até
          </label>
          <input id="to" name="to" type="date" defaultValue={searchParams.to} className="input mt-1" />
        </div>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="table-head">
            <tr>
              <th scope="col" className="px-4 py-3">Nº</th>
              <th scope="col" className="px-4 py-3">Data</th>
              <th scope="col" className="px-4 py-3">Cliente</th>
              <th scope="col" className="px-4 py-3">Pagamento</th>
              <th scope="col" className="px-4 py-3 text-right">Total</th>
              <th scope="col" className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.items.map((sale) => (
              <tr key={sale.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/sales/${sale.id}`} className="font-semibold text-brand-700 hover:underline">
                    #{sale.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDateTime(sale.createdAt)}</td>
                <td className="px-4 py-3 text-slate-700">{sale.customer?.name ?? 'Consumidor final'}</td>
                <td className="px-4 py-3 text-slate-600">{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">{formatMoney(sale.total)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <SaleStatusBadge status={sale.status} />
                    {sale.status === 'COMPLETED' && sale.fiscalDocument && (
                      <FiscalStatusBadge status={sale.fiscalDocument.status} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sales.items.length === 0 && (
          <EmptyState title="Nenhuma venda encontrada.">
            <Link href="/dashboard/sales/new" className="text-brand-700 hover:underline">
              Registrar a primeira venda
            </Link>
          </EmptyState>
        )}
      </div>

      <Pagination
        page={page}
        total={sales.total}
        pageSize={sales.pageSize}
        pathname="/dashboard/sales"
        query={{ ...searchParams, page: undefined }}
      />
    </div>
  );
}
