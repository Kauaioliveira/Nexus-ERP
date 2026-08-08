import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { MovementType, PaginatedResponse, Product, Sale, StockMovement } from '@/lib/types';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { MovementsChart } from '@/components/dashboard/MovementsChart';

function toDayKey(iso: string): string {
  return iso.slice(0, 10);
}

function buildSalesChartData(sales: Sale[]) {
  const totalsByDay = new Map<string, number>();

  for (const sale of sales) {
    if (sale.status === 'CANCELLED') continue;
    const day = toDayKey(sale.createdAt);
    totalsByDay.set(day, (totalsByDay.get(day) ?? 0) + Number(sale.total));
  }

  return Array.from(totalsByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, total]) => ({ date: date.slice(5), total: Number(total.toFixed(2)) }));
}

function buildMovementsChartData(movements: StockMovement[]) {
  const counts: Record<MovementType, number> = { ENTRADA: 0, SAIDA: 0, AJUSTE: 0 };

  for (const movement of movements) {
    counts[movement.type] += 1;
  }

  return (['ENTRADA', 'SAIDA', 'AJUSTE'] as const).map((type) => ({ type, count: counts[type] }));
}

// Os graficos sao SVGs sem texto para leitores de tela; role="img" +
// aria-label expoe um resumo equivalente dos mesmos dados (WCAG 1.1.1).
function buildSalesSummary(data: { date: string; total: number }[]): string {
  if (data.length === 0) return 'Nenhuma venda registrada nos ultimos dias.';
  const parts = data.map((point) => `dia ${point.date}: R$ ${point.total.toFixed(2)}`);
  return `Vendas por dia. ${parts.join('; ')}.`;
}

function buildMovementsSummary(data: { type: string; count: number }[]): string {
  const parts = data.map((point) => `${point.type.toLowerCase()}: ${point.count}`);
  return `Movimentacoes de estoque por tipo. ${parts.join('; ')}.`;
}

export default async function DashboardOverviewPage() {
  const [productsPage, lowStock, salesPage, movementsPage] = await Promise.all([
    apiFetch<PaginatedResponse<Product>>('/products?pageSize=1'),
    apiFetch<Product[]>('/products/low-stock'),
    apiFetch<PaginatedResponse<Sale>>('/sales?pageSize=50'),
    apiFetch<PaginatedResponse<StockMovement>>('/stock-movements?pageSize=50'),
  ]);

  const salesChartData = buildSalesChartData(salesPage.items);
  const movementsChartData = buildMovementsChartData(movementsPage.items);
  const topLowStock = lowStock.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Visao geral</h1>
        <p className="text-sm text-slate-500">Resumo do estoque, vendas recentes e movimentacoes.</p>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700">Vendas nos ultimos dias</h2>
          <p className="mb-4 text-xs text-slate-500">Total faturado por dia (baseado nas ultimas 50 vendas)</p>
          <div role="img" aria-label={buildSalesSummary(salesChartData)}>
            <SalesChart data={salesChartData} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700">Movimentacoes de estoque</h2>
          <p className="mb-4 text-xs text-slate-500">Por tipo (baseado nas ultimas 50 movimentacoes)</p>
          <div role="img" aria-label={buildMovementsSummary(movementsChartData)}>
            <MovementsChart data={movementsChartData} />
          </div>
        </div>
      </div>

      {topLowStock.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-800">Estoque baixo — atencao</h2>
          <ul className="mt-3 divide-y divide-amber-100">
            {topLowStock.map((product) => (
              <li key={product.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/dashboard/products/${product.id}`} className="font-medium text-amber-900 hover:underline">
                  {product.name}
                </Link>
                <span className="text-amber-700">
                  {product.currentStock} / min. {product.minStock}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
