import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import type { SafeUser } from '@/lib/types';
import { CreateUserForm, EditUserRow } from '@/components/users/UserForms';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Usuários' };

export default async function UsersPage() {
  const currentUser = await requireAdmin();
  const users = await apiFetch<SafeUser[]>('/users');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Operadores registram vendas, clientes e estoque. Administradores também veem custos, lucro e financeiro."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card divide-y divide-slate-100">
          {users.map((user) => (
            <EditUserRow key={user.id} user={user} isSelf={user.id === currentUser.id} />
          ))}
        </div>
        <CreateUserForm />
      </div>
    </div>
  );
}
