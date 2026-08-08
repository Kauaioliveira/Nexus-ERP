'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Role } from '@/lib/types';

const links = [
  { href: '/dashboard', label: 'Visao geral' },
  { href: '/dashboard/products', label: 'Produtos' },
  { href: '/dashboard/scan', label: 'Leitor de codigo' },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-row items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 sm:w-60 sm:flex-col sm:items-stretch sm:gap-0 sm:overflow-visible sm:border-b-0 sm:border-r sm:px-0 sm:py-0">
      <div className="hidden px-6 py-5 sm:block">
        <span className="text-lg font-semibold text-brand-700">Nexus ERP</span>
      </div>
      <nav className="flex flex-row gap-1 sm:flex-col sm:gap-0 sm:space-y-1 sm:px-3" aria-label="Navegacao principal">
        {links.map((link) => {
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? 'page' : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden px-6 py-4 text-xs text-slate-400 sm:block">Papel: {role}</div>
    </aside>
  );
}
