import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  // Defesa em profundidade: o proxy ja deveria ter barrado o acesso,
  // mas o layout confirma direto na API antes de renderizar qualquer dado.
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 sm:flex">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
