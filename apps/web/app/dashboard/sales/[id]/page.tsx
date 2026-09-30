import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { retryFiscalAction } from '@/actions/sales';
import { apiFetch, ApiError } from '@/lib/api';
import { PAYMENT_METHOD_LABELS, formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { getCurrentUser } from '@/lib/session';
import type { SaleDetail } from '@/lib/types';
import { CancelSaleForm } from '@/components/sales/CancelSaleForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrintButton } from '@/components/ui/PrintButton';
import {
  EntryStatusBadge,
  FiscalStatusBadge,
  SaleStatusBadge,
} from '@/components/ui/StatusBadges';
import { SubmitButton } from '@/components/ui/SubmitButton';

export const metadata: Metadata = { title: 'Venda' };

export default async function SaleDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nova?: string }>;
}) {
  const [{ id }, { nova }, user] = await Promise.all([
    props.params,
    props.searchParams,
    getCurrentUser(),
  ]);

  let sale: SaleDetail;
  try {
    sale = await apiFetch<SaleDetail>(`/sales/${id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const isAdmin = user?.role === 'ADMIN';
  const receivables = sale.financialEntries.filter((entry) => entry.type === 'RECEIVABLE');
  const refunds = sale.financialEntries.filter((entry) => entry.type === 'PAYABLE');
  const fiscal = sale.fiscalDocument;

  return (
    <div className="space-y-6">
      {nova && sale.status === 'COMPLETED' && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            Venda #{sale.number} finalizada: {formatMoney(sale.total)}
          </p>
          <Link href="/dashboard/sales/new" className="btn-primary btn-sm">
            Próxima venda
          </Link>
        </div>
      )}

      <PageHeader
        title={`Venda #${sale.number}`}
        description={`${formatDateTime(sale.createdAt)} · atendido por ${sale.user?.name ?? '-'}`}
        actions={
          <>
            <PrintButton label="Imprimir recibo" />
            {isAdmin && sale.status === 'COMPLETED' && (
              <CancelSaleForm saleId={sale.id} saleNumber={sale.number} />
            )}
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <SaleStatusBadge status={sale.status} />
        {fiscal && sale.status === 'COMPLETED' && <FiscalStatusBadge status={fiscal.status} />}
      </div>

      {sale.status === 'CANCELLED' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Cancelada em {formatDateTime(sale.cancelledAt)}. Motivo: {sale.cancelReason}
          {fiscal?.status === 'ISSUED' && (
            <p className="mt-1 font-medium">
              Atenção: a NF-e desta venda já tinha sido emitida. Cancele-a também no portal do
              provedor fiscal.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-x-auto lg:col-span-2">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th scope="col" className="px-4 py-3">Produto</th>
                <th scope="col" className="px-4 py-3 text-right">Qtd.</th>
                <th scope="col" className="px-4 py-3 text-right">Unitário</th>
                <th scope="col" className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sale.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{item.product.name}</p>
                    <p className="text-xs text-slate-500">{item.product.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {item.quantity} {item.product.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatMoney(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {formatMoney(Number(item.unitPrice) * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 text-sm">
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-slate-500">Subtotal</td>
                <td className="px-4 py-2 text-right">{formatMoney(sale.subtotal)}</td>
              </tr>
              {Number(sale.discount) > 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-slate-500">Desconto</td>
                  <td className="px-4 py-2 text-right">- {formatMoney(sale.discount)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right font-semibold text-slate-900">Total</td>
                <td className="px-4 py-3 text-right text-lg font-semibold text-slate-900">
                  {formatMoney(sale.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="space-y-4">
          <div className="card space-y-3 p-5 text-sm">
            <h2 className="font-semibold text-slate-900">Dados da venda</h2>
            <dl className="space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Cliente</dt>
                <dd className="text-right font-medium text-slate-900">
                  {sale.customer ? (
                    <Link href={`/dashboard/customers/${sale.customer.id}`} className="text-brand-700 hover:underline">
                      {sale.customer.name}
                    </Link>
                  ) : (
                    'Consumidor final'
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Pagamento</dt>
                <dd className="font-medium text-slate-900">{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</dd>
              </div>
              {sale.notes && (
                <div>
                  <dt className="text-slate-500">Observações</dt>
                  <dd className="mt-1 text-slate-900">{sale.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {receivables.length > 0 && (
            <div className="card p-5 text-sm">
              <h2 className="mb-3 font-semibold text-slate-900">
                {receivables.length > 1 ? 'Parcelas' : 'Recebimento'}
              </h2>
              <ul className="divide-y divide-slate-100">
                {receivables.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-slate-600">
                      {entry.installments > 1 && `${entry.installment}/${entry.installments} · `}
                      {entry.status === 'PAID' ? `pago ${formatDateTime(entry.paidAt)}` : `vence ${formatDate(entry.dueDate)}`}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{formatMoney(entry.amount)}</span>
                      <EntryStatusBadge entry={entry} />
                    </span>
                  </li>
                ))}
                {refunds.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 py-2 text-red-700">
                    <span>{entry.description}</span>
                    <span className="font-medium">- {formatMoney(entry.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fiscal && sale.status === 'COMPLETED' && (
            <div className="card no-print space-y-2 p-5 text-sm">
              <h2 className="font-semibold text-slate-900">Nota fiscal (NF-e)</h2>
              <p className="text-slate-600">
                Provedor: {fiscal.provider}
                {fiscal.externalId && ` · protocolo ${fiscal.externalId}`}
              </p>
              {fiscal.errorMessage && <p className="text-red-600">{fiscal.errorMessage}</p>}
              <div className="flex flex-wrap gap-2">
                {fiscal.pdfUrl && (
                  <a href={fiscal.pdfUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                    DANFE (PDF)
                  </a>
                )}
                {fiscal.xmlUrl && (
                  <a href={fiscal.xmlUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                    XML
                  </a>
                )}
                {isAdmin && (fiscal.status === 'FAILED' || fiscal.status === 'QUEUED') && (
                  <form action={retryFiscalAction.bind(null, sale.id)}>
                    <SubmitButton label="Reenviar NF-e" pendingLabel="Enviando..." variant="secondary" size="sm" />
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
