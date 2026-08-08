'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface SalesChartPoint {
  date: string;
  total: number;
}

export function SalesChart({ data }: { data: SalesChartPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">Ainda nao ha vendas registradas.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(value: number) => `R$${value}`} />
        <Tooltip
          formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
          labelFormatter={(label) => `Dia ${label}`}
        />
        <Bar dataKey="total" fill="#2c4fc0" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
