import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setPartnerActiveAction, updatePartnerAction } from '@/actions/partners';
import { apiFetch, ApiError } from '@/lib/api';
import { PAYMENT_METHOD_LABELS, formatDateTime, formatMoney } from '@/lib/format';
import { getCurrentUser } from '@/lib/session';
import type { CustomerDetail } from '@/lib/types';
import { PartnerForm } from '@/components/partners/PartnerForm';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SaleStatusBadge } from '@/components/ui/StatusBadges';
import { SubmitButton } from '@/components/ui/SubmitButton';

export const metadata: Metadata = { title: 'Cliente' };

export default async function CustomerDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser();

  let customer: CustomerDetail;
  try {
    customer = await apiFetch<CustomerDetail>(`/customers/${id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const openBalance = Number(customer.stats.openBalance);

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={
          <span className="inline-flex items-center gap-2">
            Cliente desde {formatDateTime(customer.createdAt).slice(0, 10)}
            {!customer.active && <Badge>Inativo</Badge>}
          </span>
        }
        actions={
          user?.role === 'ADMIN' && (
            <form action={setPartnerActiveAction.bind(null, 'customers', customer.id, !customer.active)}>
              <SubmitButton
                label={customer.active ? 'Desativar' : 'Reativar'}
                pendingLabel="Aguarde..."
                variant={customer.active ? 'danger' : 'secondary'}
              />
            </form>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Compras concluídas" value={customer.stats.salesCount} />
        <StatCard label="Total comprado" value={formatMoney(customer.stats.salesTotal)} />
        <StatCard
          label="Saldo devedor"
          value={formatMoney(openBalance)}
          tone={openBalance > 0 ? 'warning' : 'default'}
          hint={openBalance > 0 ? 'Parcelas a prazo em aberto' : 'Nada em aberto'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PartnerForm
          action={updatePartnerAction.bind(null, 'customers', customer.id)}
          values={customer}
          kind="customer"
          submitLabel="Salvar alterações"
        />

        <div className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-900">
            Últimas compras
          </h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {customer.recentSales.map((sale) => (
              <li key={sale.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <Link href={`/dashboard/sales/${sale.id}`} className="font-medium text-brand-700 hover:underline">
                    Venda #{sale.number}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(sale.createdAt)} · {PAYMENT_METHOD_LABELS[sale.paymentMethod]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatMoney(sale.total)}</span>
                  <SaleStatusBadge status={sale.status} />
                </div>
              </li>
            ))}
            {customer.recentSales.length === 0 && (
              <li className="px-5 py-8 text-center text-slate-500">Nenhuma compra ainda.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
