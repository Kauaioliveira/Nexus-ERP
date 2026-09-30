'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/lib/format';

interface SalesChartPoint {
  date: string;
  total: number;
  count: number;
}

export function SalesChart({ data }: { data: SalesChartPoint[] }) {
  if (data.every((point) => point.total === 0)) {
    return <p className="py-16 text-center text-sm text-slate-500">Ainda não há vendas no período.</p>;
  }

  const chartData = data.map((point) => ({
    ...point,
    label: `${point.date.slice(8, 10)}/${point.date.slice(5, 7)}`,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2c4fc0" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#2c4fc0" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(value: number) => `R$${value}`} width={70} />
        <Tooltip
          formatter={(value) => [formatMoney(Number(value)), 'Faturamento']}
          labelFormatter={(label) => `Dia ${label}`}
        />
        <Area type="monotone" dataKey="total" stroke="#2c4fc0" strokeWidth={2} fill="url(#salesFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
