import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDownCircle, ArrowUpCircle, Plus, Scale } from 'lucide-react';
import { cancelEntryAction, payEntryAction, reopenEntryAction } from '@/actions/finance';
import { apiFetch } from '@/lib/api';
import {
  ENTRY_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  formatDate,
  formatDateTime,
  formatMoney,
} from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import type { FinancialEntry, FinancialSummary, PaginatedResponse } from '@/lib/types';
import { CashFlowChart } from '@/components/finance/CashFlowChart';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { StatCard } from '@/components/ui/StatCard';
import { EntryStatusBadge } from '@/components/ui/StatusBadges';
import { SubmitButton } from '@/components/ui/SubmitButton';

export const metadata: Metadata = { title: 'Financeiro' };

interface SearchParams {
  type?: string;
  status?: string;
  overdue?: string;
  dueFrom?: string;
  dueTo?: string;
  search?: string;
  page?: string;
}

const TABS = [
  { type: 'RECEIVABLE', label: 'A receber' },
  { type: 'PAYABLE', label: 'A pagar' },
  { type: '', label: 'Todos' },
];

export default async function FinancePage(props: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const searchParams = await props.searchParams;
  const page = Number(searchParams.page ?? '1') || 1;
  const type = searchParams.type ?? 'RECEIVABLE';
  const status = searchParams.status ?? (searchParams.overdue ? '' : 'OPEN');

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  if (searchParams.overdue) params.set('overdue', 'true');
  for (const key of ['dueFrom', 'dueTo', 'search'] as const) {
    if (searchParams[key]) params.set(key, searchParams[key]);
  }

  const [entries, summary] = await Promise.all([
    apiFetch<PaginatedResponse<FinancialEntry> & { totalAmount: string }>(
      `/financial-entries?${params.toString()}`,
    ),
    apiFetch<FinancialSummary>('/financial-entries/summary'),
  ]);

  const query = { ...searchParams, type, page: undefined };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Contas a pagar e a receber, com o fluxo de caixa do mês."
        actions={
          <Link href={`/dashboard/finance/new?type=${type || 'PAYABLE'}`} className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            Novo lançamento
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Entradas no mês"
          value={formatMoney(summary.cashFlow.received)}
          icon={<ArrowDownCircle className="h-5 w-5 text-emerald-500" />}
          tone="positive"
        />
        <StatCard
          label="Saídas no mês"
          value={formatMoney(summary.cashFlow.paid)}
          icon={<ArrowUpCircle className="h-5 w-5 text-red-500" />}
          tone="negative"
        />
        <StatCard
          label="Saldo do mês"
          value={formatMoney(summary.cashFlow.balance)}
          icon={<Scale className="h-5 w-5" />}
          tone={summary.cashFlow.balance >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="Contas vencidas"
          value={summary.receivables.overdue.count + summary.payables.overdue.count}
          hint={`${formatMoney(summary.receivables.overdue.total)} a receber · ${formatMoney(summary.payables.overdue.total)} a pagar`}
          tone={summary.receivables.overdue.count + summary.payables.overdue.count > 0 ? 'warning' : 'default'}
          href={`/dashboard/finance?type=${type}&overdue=true`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700">Fluxo de caixa diário</h2>
          <p className="mb-3 text-xs text-slate-500">
            {formatDate(summary.period.from)} a {formatDate(summary.period.to)}
          </p>
          <CashFlowChart data={summary.cashFlow.daily} />
        </div>
        <div className="card divide-y divide-slate-100 text-sm">
          {[
            ['A receber em aberto', summary.receivables.open],
            ['A receber nos próximos 7 dias', summary.receivables.next7Days],
            ['A pagar em aberto', summary.payables.open],
            ['A pagar nos próximos 7 dias', summary.payables.next7Days],
          ].map(([label, bucket]) => {
            const { total, count } = bucket as { total: number; count: number };
            return (
              <div key={label as string} className="flex items-center justify-between px-5 py-4">
                <span className="text-slate-600">{label as string}</span>
                <span className="text-right">
                  <span className="block font-semibold text-slate-900">{formatMoney(total)}</span>
                  <span className="text-xs text-slate-500">{count} lançamento(s)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <nav className="no-print flex flex-wrap gap-2" aria-label="Tipo de lançamento">
        {TABS.map((tab) => {
          const active = type === tab.type;
          return (
            <Link
              key={tab.type || 'all'}
              href={`/dashboard/finance?type=${tab.type}`}
              aria-current={active ? 'page' : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                active ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <form method="GET" className="card flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="type" value={type} />
        <div className="min-w-[180px] flex-1">
          <label htmlFor="search" className="label">
            Descrição
          </label>
          <input id="search" name="search" type="search" defaultValue={searchParams.search} className="input mt-1" />
        </div>
        <div>
          <label htmlFor="status" className="label">
            Situação
          </label>
          <select id="status" name="status" defaultValue={status} className="input mt-1">
            <option value="OPEN">Em aberto</option>
            <option value="PAID">Quitados</option>
            <option value="CANCELLED">Cancelados</option>
            <option value="">Todos</option>
          </select>
        </div>
        <div>
          <label htmlFor="dueFrom" className="label">
            Vencimento de
          </label>
          <input id="dueFrom" name="dueFrom" type="date" defaultValue={searchParams.dueFrom} className="input mt-1" />
        </div>
        <div>
          <label htmlFor="dueTo" className="label">
            até
          </label>
          <input id="dueTo" name="dueTo" type="date" defaultValue={searchParams.dueTo} className="input mt-1" />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" name="overdue" value="true" defaultChecked={Boolean(searchParams.overdue)} />
          Só vencidos
        </label>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="table-head">
            <tr>
              <th scope="col" className="px-4 py-3">Vencimento</th>
              <th scope="col" className="px-4 py-3">Descrição</th>
              <th scope="col" className="px-4 py-3">Cliente / fornecedor</th>
              <th scope="col" className="px-4 py-3 text-right">Valor</th>
              <th scope="col" className="px-4 py-3">Situação</th>
              <th scope="col" className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.items.map((entry) => {
              const origin = entry.sale
                ? { href: `/dashboard/sales/${entry.sale.id}`, label: `Venda #${entry.sale.number}` }
                : entry.purchaseOrder
                  ? { href: `/dashboard/purchases/${entry.purchaseOrder.id}`, label: `Compra #${entry.purchaseOrder.number}` }
                  : null;
              return (
                <tr key={entry.id} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(entry.dueDate)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{entry.description}</p>
                    <p className="text-xs text-slate-500">
                      {!type && `${ENTRY_TYPE_LABELS[entry.type]} · `}
                      {entry.category ?? 'Sem categoria'}
                      {origin && (
                        <>
                          {' · '}
                          <Link href={origin.href} className="text-brand-700 hover:underline">
                            {origin.label}
                          </Link>
                        </>
                      )}
                      {entry.paidAt && ` · pago ${formatDateTime(entry.paidAt)}`}
                      {entry.paymentMethod && entry.status === 'PAID' && ` (${PAYMENT_METHOD_LABELS[entry.paymentMethod]})`}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{entry.customer?.name ?? entry.supplier?.name ?? '-'}</td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                      entry.type === 'RECEIVABLE' ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {entry.type === 'PAYABLE' && '- '}
                    {formatMoney(entry.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <EntryStatusBadge entry={entry} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {entry.status === 'OPEN' && (
                        <>
                          <form action={payEntryAction.bind(null, entry.id)} className="flex gap-1">
                            <label htmlFor={`pm-${entry.id}`} className="sr-only">
                              Forma de pagamento
                            </label>
                            <select
                              id={`pm-${entry.id}`}
                              name="paymentMethod"
                              defaultValue={
                                entry.paymentMethod && entry.paymentMethod !== 'A_PRAZO'
                                  ? entry.paymentMethod
                                  : 'PIX'
                              }
                              className="rounded-md border border-slate-300 px-1.5 py-1 text-xs"
                            >
                              {Object.entries(PAYMENT_METHOD_LABELS)
                                .filter(([value]) => value !== 'A_PRAZO')
                                .map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                            </select>
                            <SubmitButton
                              label={entry.type === 'RECEIVABLE' ? 'Receber' : 'Pagar'}
                              pendingLabel="..."
                              size="sm"
                            />
                          </form>
                          <form action={cancelEntryAction.bind(null, entry.id)}>
                            <SubmitButton
                              label="Cancelar"
                              pendingLabel="..."
                              variant="secondary"
                              size="sm"
                              confirmMessage="Cancelar este lançamento?"
                            />
                          </form>
                        </>
                      )}
                      {entry.status === 'PAID' && (
                        <form action={reopenEntryAction.bind(null, entry.id)}>
                          <SubmitButton
                            label="Estornar baixa"
                            pendingLabel="..."
                            variant="secondary"
                            size="sm"
                            confirmMessage="Voltar este lançamento para em aberto?"
                          />
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {entries.items.length > 0 && (
            <tfoot className="border-t border-slate-200">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right text-sm text-slate-500">
                  Total filtrado ({entries.total})
                </td>
                <td className="px-4 py-3 text-right font-semibold">{formatMoney(entries.totalAmount)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
        {entries.items.length === 0 && <EmptyState title="Nenhum lançamento encontrado com esses filtros." />}
      </div>

      <Pagination
        page={page}
        total={entries.total}
        pageSize={entries.pageSize}
        pathname="/dashboard/finance"
        query={query}
      />
    </div>
  );
}
