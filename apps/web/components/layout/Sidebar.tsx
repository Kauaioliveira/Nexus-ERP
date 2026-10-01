'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  Boxes,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  ScanBarcode,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  Wallet,
  PackagePlus,
} from 'lucide-react';
import { Role } from '@/lib/types';

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const groups: { title?: string; links: NavLink[] }[] = [
  { links: [{ href: '/dashboard', label: 'Visão geral', icon: LayoutDashboard }] },
  {
    title: 'Vendas',
    links: [
      { href: '/dashboard/sales/new', label: 'Nova venda (PDV)', icon: ShoppingCart },
      { href: '/dashboard/sales', label: 'Vendas', icon: Receipt },
      { href: '/dashboard/customers', label: 'Clientes', icon: Users },
    ],
  },
  {
    title: 'Estoque',
    links: [
      { href: '/dashboard/products', label: 'Produtos', icon: Boxes },
      { href: '/dashboard/stock', label: 'Movimentações', icon: ArrowLeftRight },
      { href: '/dashboard/purchases', label: 'Compras', icon: PackagePlus },
      { href: '/dashboard/suppliers', label: 'Fornecedores', icon: Truck },
      { href: '/dashboard/scan', label: 'Leitor de código', icon: ScanBarcode },
    ],
  },
  {
    title: 'Gestão',
    links: [
      { href: '/dashboard/finance', label: 'Financeiro', icon: Wallet, adminOnly: true },
      { href: '/dashboard/users', label: 'Usuários', icon: UserCog, adminOnly: true },
    ],
  },
];

const allHrefs = groups.flatMap((group) => group.links.map((link) => link.href));

// Link ativo = o prefixo mais especifico que casa com a rota atual (assim
// /dashboard/sales/new destaca "Nova venda" e nao "Vendas").
function activeHref(pathname: string): string | undefined {
  return allHrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const current = activeHref(pathname);

  return (
    <aside className="no-print border-b border-slate-200 bg-white sm:sticky sm:top-0 sm:flex sm:h-screen sm:w-64 sm:shrink-0 sm:flex-col sm:border-b-0 sm:border-r">
      <div className="hidden items-center gap-2 px-6 py-5 sm:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          N
        </span>
        <span className="text-lg font-semibold tracking-tight text-slate-900">Nexus ERP</span>
      </div>
      <nav
        className="flex gap-1 overflow-x-auto px-3 py-2 sm:flex-1 sm:flex-col sm:gap-4 sm:overflow-y-auto sm:py-2"
        aria-label="Navegação principal"
      >
        {groups.map((group, index) => {
          const links = group.links.filter((link) => !link.adminOnly || role === 'ADMIN');
          if (links.length === 0) return null;

          return (
            <div key={group.title ?? index} className="flex gap-1 sm:flex-col">
              {group.title && (
                <p className="hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:block">
                  {group.title}
                </p>
              )}
              {links.map((link) => {
                const isActive = link.href === current;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
