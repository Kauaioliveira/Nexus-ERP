import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PURCHASE_STATUS_LABELS, formatDate, formatMoney } from '@/lib/format';
import { getCurrentUser } from '@/lib/session';
import type { PaginatedResponse, PurchaseOrder } from '@/lib/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { PurchaseStatusBadge } from '@/components/ui/StatusBadges';

export const metadata: Metadata = { title: 'Compras' };

export default async function PurchasesPage(props: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const page = Number(searchParams.page ?? '1') || 1;
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (searchParams.status) params.set('status', searchParams.status);

  const [orders, user] = await Promise.all([
    apiFetch<PaginatedResponse<PurchaseOrder>>(`/purchase-orders?${params.toString()}`),
    getCurrentUser(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compras"
        description="Pedidos de compra aos fornecedores. Ao receber, o estoque e o contas a pagar são atualizados."
        actions={
          user?.role === 'ADMIN' && (
            <Link href="/dashboard/purchases/new" className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden />
              Novo pedido
            </Link>
          )
        }
      />

      <nav className="no-print flex flex-wrap gap-2" aria-label="Filtrar por situação">
        {[['', 'Todos'], ...Object.entries(PURCHASE_STATUS_LABELS)].map(([value, label]) => {
          const active = (searchParams.status ?? '') === value;
          return (
            <Link
              key={value}
              href={value ? `/dashboard/purchases?status=${value}` : '/dashboard/purchases'}
              aria-current={active ? 'page' : undefined}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                active ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="table-head">
            <tr>
              <th scope="col" className="px-4 py-3">Nº</th>
              <th scope="col" className="px-4 py-3">Fornecedor</th>
              <th scope="col" className="px-4 py-3">Criado em</th>
              <th scope="col" className="px-4 py-3">Previsão</th>
              <th scope="col" className="px-4 py-3 text-right">Total</th>
              <th scope="col" className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.items.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/purchases/${order.id}`} className="font-semibold text-brand-700 hover:underline">
                    #{order.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{order.supplier.name}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(order.createdAt)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(order.expectedAt)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(order.total)}</td>
                <td className="px-4 py-3">
                  <PurchaseStatusBadge status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.items.length === 0 && <EmptyState title="Nenhum pedido de compra." />}
      </div>

      <Pagination
        page={page}
        total={orders.total}
        pageSize={orders.pageSize}
        pathname="/dashboard/purchases"
        query={{ status: searchParams.status }}
      />
    </div>
  );
}
