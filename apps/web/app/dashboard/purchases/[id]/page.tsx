import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cancelPurchaseOrderAction } from '@/actions/purchases';
import { apiFetch, ApiError } from '@/lib/api';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { getCurrentUser } from '@/lib/session';
import type { PurchaseOrderDetail } from '@/lib/types';
import { ReceivePurchaseForm } from '@/components/purchases/ReceivePurchaseForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrintButton } from '@/components/ui/PrintButton';
import { EntryStatusBadge, PurchaseStatusBadge } from '@/components/ui/StatusBadges';
import { SubmitButton } from '@/components/ui/SubmitButton';

export const metadata: Metadata = { title: 'Pedido de compra' };

export default async function PurchaseDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser();

  let order: PurchaseOrderDetail;
  try {
    order = await apiFetch<PurchaseOrderDetail>(`/purchase-orders/${id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pedido de compra #${order.number}`}
        description={
          <>
            <Link href={`/dashboard/suppliers/${order.supplier.id}`} className="text-brand-700 hover:underline">
              {order.supplier.name}
            </Link>{' '}
            · criado em {formatDateTime(order.createdAt)} por {order.user.name}
          </>
        }
        actions={
          <>
            <PrintButton />
            {isAdmin && order.status === 'ORDERED' && (
              <form action={cancelPurchaseOrderAction.bind(null, order.id)}>
                <SubmitButton
                  label="Cancelar pedido"
                  pendingLabel="Cancelando..."
                  variant="danger"
                  confirmMessage="Cancelar este pedido de compra?"
                />
              </form>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <PurchaseStatusBadge status={order.status} />
        {order.expectedAt && <span>Previsão de entrega: {formatDate(order.expectedAt)}</span>}
        {order.receivedAt && <span>Recebido em {formatDateTime(order.receivedAt)}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-x-auto lg:col-span-2">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th scope="col" className="px-4 py-3">Produto</th>
                <th scope="col" className="px-4 py-3 text-right">Qtd.</th>
                <th scope="col" className="px-4 py-3 text-right">Custo unit.</th>
                <th scope="col" className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/products/${item.product.id}`} className="font-medium text-brand-700 hover:underline">
                      {item.product.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {item.product.sku} · estoque atual {item.product.currentStock}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.quantity} {item.product.unit}
                  </td>
                  <td className="px-4 py-3 text-right">{formatMoney(item.unitCost)}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatMoney(Number(item.unitCost) * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right font-semibold">Total</td>
                <td className="px-4 py-3 text-right text-lg font-semibold">{formatMoney(order.total)}</td>
              </tr>
            </tfoot>
          </table>
          {order.notes && <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">Obs.: {order.notes}</p>}
        </div>

        <div className="space-y-4">
          {order.status === 'ORDERED' && <ReceivePurchaseForm orderId={order.id} />}

          {order.financialEntries.length > 0 && (
            <div className="card p-5 text-sm">
              <h2 className="mb-3 font-semibold text-slate-900">Contas a pagar</h2>
              <ul className="divide-y divide-slate-100">
                {order.financialEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-slate-600">
                      {entry.installments > 1 && `${entry.installment}/${entry.installments} · `}
                      vence {formatDate(entry.dueDate)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{formatMoney(entry.amount)}</span>
                      <EntryStatusBadge entry={entry} />
                    </span>
                  </li>
                ))}
              </ul>
              {isAdmin && (
                <Link href="/dashboard/finance?type=PAYABLE" className="mt-3 inline-block text-brand-700 hover:underline">
                  Ver no financeiro
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
