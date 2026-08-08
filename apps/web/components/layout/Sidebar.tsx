import Link from 'next/link';
import { Role } from '@/lib/types';

const links = [
  { href: '/dashboard', label: 'Visao geral' },
  { href: '/dashboard/products', label: 'Produtos' },
];

export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white sm:flex">
      <div className="px-6 py-5">
        <span className="text-lg font-semibold text-brand-700">Nexus ERP</span>
      </div>
      <nav className="space-y-1 px-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto px-6 py-4 text-xs text-slate-400">Papel: {role}</div>
    </aside>
  );
}
