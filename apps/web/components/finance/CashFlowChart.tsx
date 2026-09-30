'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '@/lib/format';

interface Point {
  date: string;
  received: number;
  paid: number;
}

export function CashFlowChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-slate-500">Sem entradas ou saídas no período.</p>;
  }

  const chartData = data.map((point) => ({ ...point, label: point.date.slice(8, 10) + '/' + point.date.slice(5, 7) }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v: number) => `R$${v}`} width={70} />
        <Tooltip formatter={(value, name) => [formatMoney(Number(value)), name]} />
        <Legend />
        <Bar dataKey="received" name="Entradas" fill="#059669" radius={[4, 4, 0, 0]} />
        <Bar dataKey="paid" name="Saídas" fill="#dc2626" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
