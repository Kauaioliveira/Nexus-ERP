import { logoutAction } from '@/actions/auth';
import { SafeUser } from '@/lib/types';

export function Header({ user }: { user: SafeUser }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <p className="text-sm font-medium text-slate-900">{user.name}</p>
        <p className="text-xs text-slate-500">{user.email}</p>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Sair
        </button>
      </form>
    </header>
  );
}
