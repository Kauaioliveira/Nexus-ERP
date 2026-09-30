import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setPartnerActiveAction, updatePartnerAction } from '@/actions/partners';
import { apiFetch, ApiError } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { getCurrentUser } from '@/lib/session';
import type { PaginatedResponse, PurchaseOrder, Supplier } from '@/lib/types';
import { PartnerForm } from '@/components/partners/PartnerForm';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { PurchaseStatusBadge } from '@/components/ui/StatusBadges';
import { SubmitButton } from '@/components/ui/SubmitButton';

export const metadata: Metadata = { title: 'Fornecedor' };

export default async function SupplierDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  const isAdmin = user?.role === 'ADMIN';

  let supplier: Supplier;
  try {
    supplier = await apiFetch<Supplier>(`/suppliers/${id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const orders = await apiFetch<PaginatedResponse<PurchaseOrder>>(
    `/purchase-orders?supplierId=${id}&pageSize=10`,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.name}
        description={!supplier.active ? <Badge>Inativo</Badge> : supplier.document ?? undefined}
        actions={
          isAdmin && (
            <>
              <Link href={`/dashboard/purchases/new?supplierId=${supplier.id}`} className="btn-primary">
                Novo pedido de compra
              </Link>
              <form action={setPartnerActiveAction.bind(null, 'suppliers', supplier.id, !supplier.active)}>
                <SubmitButton
                  label={supplier.active ? 'Desativar' : 'Reativar'}
                  pendingLabel="Aguarde..."
                  variant={supplier.active ? 'danger' : 'secondary'}
                />
              </form>
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {isAdmin ? (
          <PartnerForm
            action={updatePartnerAction.bind(null, 'suppliers', supplier.id)}
            values={supplier}
            kind="supplier"
            submitLabel="Salvar alterações"
          />
        ) : (
          <div className="card space-y-2 p-6 text-sm">
            <p><span className="text-slate-500">Documento:</span> {supplier.document ?? '-'}</p>
            <p><span className="text-slate-500">Telefone:</span> {supplier.phone ?? '-'}</p>
            <p><span className="text-slate-500">E-mail:</span> {supplier.email ?? '-'}</p>
          </div>
        )}

        <div className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-900">
            Pedidos de compra recentes
          </h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {orders.items.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <Link href={`/dashboard/purchases/${order.id}`} className="font-medium text-brand-700 hover:underline">
                    Pedido #{order.number}
                  </Link>
                  <p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatMoney(order.total)}</span>
                  <PurchaseStatusBadge status={order.status} />
                </div>
              </li>
            ))}
            {orders.items.length === 0 && (
              <li className="px-5 py-8 text-center text-slate-500">Nenhum pedido ainda.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
