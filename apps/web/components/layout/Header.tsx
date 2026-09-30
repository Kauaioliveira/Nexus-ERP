import { LogOut } from 'lucide-react';
import { logoutAction } from '@/actions/auth';
import { SafeUser } from '@/lib/types';

export function Header({ user }: { user: SafeUser }) {
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="no-print flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
        >
          {initials}
        </span>
        <div className="text-right sm:text-left">
          <p className="text-sm font-medium text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">
            {user.role === 'ADMIN' ? 'Administrador' : 'Operador'} · {user.email}
          </p>
        </div>
      </div>
      <form action={logoutAction}>
        <button type="submit" className="btn-secondary btn-sm" aria-label="Sair">
          <LogOut className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </form>
    </header>
  );
}
