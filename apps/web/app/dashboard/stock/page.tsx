import type { Metadata } from 'next';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { MOVEMENT_TYPE_LABELS, formatDateTime } from '@/lib/format';
import type { MovementType, PaginatedResponse, StockMovement } from '@/lib/types';
import { MovementForm } from '@/components/stock/MovementForm';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';

export const metadata: Metadata = { title: 'Movimentações de estoque' };

const TYPE_TONES: Record<MovementType, BadgeTone> = {
  ENTRADA: 'success',
  SAIDA: 'danger',
  AJUSTE: 'warning',
};

export default async function StockPage(props: {
  searchParams: Promise<{ type?: string; productId?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const page = Number(searchParams.page ?? '1') || 1;
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (searchParams.type) params.set('type', searchParams.type);
  if (searchParams.productId) params.set('productId', searchParams.productId);

  const movements = await apiFetch<PaginatedResponse<StockMovement>>(`/stock-movements?${params.toString()}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimentações de estoque"
        description="Histórico de tudo que entrou e saiu, com quem fez e por quê."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <nav className="no-print flex flex-wrap gap-2" aria-label="Filtrar por tipo">
            {[['', 'Todas'], ...Object.entries(MOVEMENT_TYPE_LABELS)].map(([value, label]) => {
              const active = (searchParams.type ?? '') === value;
              const query = new URLSearchParams();
              if (value) query.set('type', value);
              if (searchParams.productId) query.set('productId', searchParams.productId);
              return (
                <Link
                  key={value}
                  href={`/dashboard/stock?${query.toString()}`}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    active ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            {searchParams.productId && (
              <Link href="/dashboard/stock" className="rounded-full px-3 py-1 text-sm text-brand-700 hover:underline">
                Limpar filtro de produto
              </Link>
            )}
          </nav>

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th scope="col" className="px-4 py-3">Data</th>
                  <th scope="col" className="px-4 py-3">Produto</th>
                  <th scope="col" className="px-4 py-3">Tipo</th>
                  <th scope="col" className="px-4 py-3 text-right">Qtd.</th>
                  <th scope="col" className="px-4 py-3">Motivo</th>
                  <th scope="col" className="px-4 py-3">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.items.map((movement) => {
                  const signed =
                    movement.type === 'SAIDA'
                      ? -movement.quantity
                      : movement.quantity;
                  return (
                    <tr key={movement.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(movement.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/products/${movement.product.id}`} className="font-medium text-brand-700 hover:underline">
                          {movement.product.name}
                        </Link>
                        <p className="text-xs text-slate-500">{movement.product.sku}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={TYPE_TONES[movement.type]}>{MOVEMENT_TYPE_LABELS[movement.type]}</Badge>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${signed < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {signed > 0 ? `+${signed}` : signed}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{movement.reason ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{movement.user?.name ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {movements.items.length === 0 && <EmptyState title="Nenhuma movimentação encontrada." />}
          </div>

          <Pagination
            page={page}
            total={movements.total}
            pageSize={movements.pageSize}
            pathname="/dashboard/stock"
            query={{ type: searchParams.type, productId: searchParams.productId }}
          />
        </div>

        <MovementForm />
      </div>
    </div>
  );
}
