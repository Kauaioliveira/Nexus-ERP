import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  // Defesa em profundidade: o middleware ja deveria ter barrado o acesso,
  // mas o layout confirma direto na API antes de renderizar qualquer dado.
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 sm:flex-row">
      <Sidebar role={user.role} />
      <div className="flex flex-1 flex-col">
        <Header user={user} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
