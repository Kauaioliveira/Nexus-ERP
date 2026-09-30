import Link from 'next/link';
import type { ReactNode } from 'react';

type Tone = 'default' | 'positive' | 'warning' | 'negative';

const VALUE_TONES: Record<Tone, string> = {
  default: 'text-slate-900',
  positive: 'text-emerald-700',
  warning: 'text-amber-700',
  negative: 'text-red-700',
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  href?: string;
  tone?: Tone;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${VALUE_TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );

  const className = 'card block p-5';

  return href ? (
    <Link href={href} className={`${className} transition hover:border-brand-100 hover:shadow`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
