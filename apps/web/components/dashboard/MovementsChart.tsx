'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface MovementsChartPoint {
  type: string;
  count: number;
}

const COLORS: Record<string, string> = {
  ENTRADA: '#059669',
  SAIDA: '#dc2626',
  AJUSTE: '#d97706',
};

export function MovementsChart({ data }: { data: MovementsChartPoint[] }) {
  if (data.every((point) => point.count === 0)) {
    return <p className="text-sm text-slate-500">Ainda nao ha movimentacoes de estoque registradas.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="type" tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.type} fill={COLORS[entry.type] ?? '#64748b'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
