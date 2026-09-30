import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, PackagePlus, Receipt, ShoppingCart, TrendingUp, Wallet } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PAYMENT_METHOD_LABELS, formatMoney } from '@/lib/format';
import { getCurrentUser } from '@/lib/session';
import type { FinancialSummary, Overview, Product } from '@/lib/types';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';

export const metadata: Metadata = { title: 'Visão geral' };

// O grafico e um SVG sem texto para leitores de tela; role="img" +
// aria-label expoe um resumo equivalente dos mesmos dados (WCAG 1.1.1).
function salesSummary(data: Overview['salesByDay']): string {
  const withSales = data.filter((point) => point.total > 0);
  if (withSales.length === 0) return 'Nenhuma venda no período.';
  const best = data.reduce((a, b) => (b.total > a.total ? b : a));
  const total = data.reduce((sum, point) => sum + point.total, 0);
  return `Faturamento diário: ${withSales.length} dia(s) com vendas, total ${formatMoney(total)}, melhor dia ${best.date} com ${formatMoney(best.total)}.`;
}

export default async function DashboardOverviewPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === 'ADMIN';

  const [overview, lowStock, finance] = await Promise.all([
    apiFetch<Overview>('/reports/overview'),
    apiFetch<Product[]>('/products/low-stock'),
    isAdmin ? apiFetch<FinancialSummary>('/financial-entries/summary') : Promise.resolve(null),
  ]);

  const topLowStock = lowStock.slice(0, 6);
  const paymentTotal = overview.paymentMethods.reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Olá, ${user?.name.split(' ')[0] ?? ''}`}
        description="Resumo dos últimos 30 dias."
        actions={
          <>
            <Link href="/dashboard/sales/new" className="btn-primary">
              <ShoppingCart className="h-4 w-4" aria-hidden />
              Nova venda
            </Link>
            {isAdmin && (
              <Link href="/dashboard/purchases/new" className="btn-secondary">
                <PackagePlus className="h-4 w-4" aria-hidden />
                Pedido de compra
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Vendas hoje"
          value={formatMoney(overview.today.total)}
          hint={`${overview.today.count} venda(s)`}
          icon={<Receipt className="h-5 w-5" />}
          href="/dashboard/sales"
        />
        <StatCard
          label="Faturamento (30 dias)"
          value={formatMoney(overview.sales.revenue)}
          hint={`${overview.sales.count} vendas · ticket médio ${formatMoney(overview.sales.averageTicket)}`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        {isAdmin && overview.sales.grossProfit !== undefined ? (
          <StatCard
            label="Lucro bruto (30 dias)"
            value={formatMoney(overview.sales.grossProfit)}
            hint={`Margem de ${overview.sales.grossMargin?.toLocaleString('pt-BR')}%`}
            tone={overview.sales.grossProfit >= 0 ? 'positive' : 'negative'}
          />
        ) : (
          <StatCard label="Produtos ativos" value={overview.stock.activeProducts} href="/dashboard/products" />
        )}
        <StatCard
          label="Estoque baixo"
          value={overview.stock.lowStock}
          hint="Produtos no mínimo ou abaixo"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={overview.stock.lowStock > 0 ? 'warning' : 'default'}
          href="/dashboard/products"
        />
      </div>

      {finance && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Saldo de caixa do mês"
            value={formatMoney(finance.cashFlow.balance)}
            hint={`Entradas ${formatMoney(finance.cashFlow.received)} · saídas ${formatMoney(finance.cashFlow.paid)}`}
            icon={<Wallet className="h-5 w-5" />}
            tone={finance.cashFlow.balance >= 0 ? 'positive' : 'negative'}
            href="/dashboard/finance"
          />
          <StatCard
            label="A receber vencido"
            value={formatMoney(finance.receivables.overdue.total)}
            hint={`${finance.receivables.overdue.count} parcela(s) · em aberto ${formatMoney(finance.receivables.open.total)}`}
            tone={finance.receivables.overdue.count > 0 ? 'warning' : 'default'}
            href="/dashboard/finance?type=RECEIVABLE&overdue=true"
          />
          <StatCard
            label="A pagar nos próximos 7 dias"
            value={formatMoney(finance.payables.next7Days.total)}
            hint={`${finance.payables.overdue.count} conta(s) já vencida(s)`}
            tone={finance.payables.overdue.count > 0 ? 'negative' : 'default'}
            href="/dashboard/finance?type=PAYABLE"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700">Faturamento por dia</h2>
          <p className="mb-4 text-xs text-slate-500">Vendas concluídas (canceladas não entram)</p>
          <div role="img" aria-label={salesSummary(overview.salesByDay)}>
            <SalesChart data={overview.salesByDay} />
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Formas de pagamento</h2>
          {overview.paymentMethods.length === 0 && <p className="text-sm text-slate-500">Sem vendas no período.</p>}
          <ul className="space-y-3">
            {overview.paymentMethods.map((row) => {
              const share = paymentTotal > 0 ? Math.round((row.total / paymentTotal) * 100) : 0;
              return (
                <li key={row.paymentMethod} className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-700">{PAYMENT_METHOD_LABELS[row.paymentMethod]}</span>
                    <span className="font-medium">{formatMoney(row.total)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100" aria-hidden>
                    <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${share}%` }} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {row.count} venda(s) · {share}%
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-700">
            Mais vendidos
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th scope="col" className="px-5 py-2">Produto</th>
                <th scope="col" className="px-5 py-2 text-right">Qtd.</th>
                <th scope="col" className="px-5 py-2 text-right">Faturamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overview.topProducts.map((row) => (
                <tr key={row.productId}>
                  <td className="px-5 py-2.5">
                    <Link href={`/dashboard/products/${row.productId}`} className="font-medium text-brand-700 hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5 text-right">{row.quantity}</td>
                  <td className="px-5 py-2.5 text-right font-medium">{formatMoney(row.revenue)}</td>
                </tr>
              ))}
              {overview.topProducts.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-500">
                    Sem vendas no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-700">Repor estoque</h2>
            {isAdmin && lowStock.length > 0 && (
              <Link href="/dashboard/purchases/new" className="text-sm text-brand-700 hover:underline">
                Fazer pedido
              </Link>
            )}
          </div>
          <ul className="divide-y divide-slate-100">
            {topLowStock.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <div>
                  <Link href={`/dashboard/products/${product.id}`} className="font-medium text-slate-900 hover:underline">
                    {product.name}
                  </Link>
                  <p className="text-xs text-slate-500">{product.supplier?.name ?? 'Sem fornecedor'}</p>
                </div>
                <span className="whitespace-nowrap font-medium text-amber-700">
                  {product.currentStock} / mín. {product.minStock}
                </span>
              </li>
            ))}
            {topLowStock.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-slate-500">Tudo abastecido.</li>
            )}
          </ul>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Estoque a preço de venda: {formatMoney(overview.stock.saleValue)}
        {overview.stock.costValue !== undefined && ` · a preço de custo: ${formatMoney(overview.stock.costValue)}`}
      </p>
    </div>
  );
}
