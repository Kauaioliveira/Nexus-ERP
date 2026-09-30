'use client';

import { useActionState } from 'react';
import { createUserAction, updateUserAction } from '@/actions/users';
import { Field, SelectField } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/FormMessage';
import { SubmitButton } from '@/components/ui/SubmitButton';
import type { SafeUser } from '@/lib/types';

const ROLE_OPTIONS = [
  { value: 'OPERATOR', label: 'Operador (caixa/estoque)' },
  { value: 'ADMIN', label: 'Administrador' },
];

export function CreateUserForm() {
  const [state, formAction] = useActionState(createUserAction, {});

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <h2 className="font-semibold text-slate-900">Novo usuário</h2>
      <Field label="Nome" name="name" required minLength={2} />
      <Field label="E-mail" name="email" type="email" required autoComplete="off" />
      <Field
        label="Senha inicial"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        hint="Mínimo 8 caracteres, com letras e números."
      />
      <SelectField label="Papel" name="role" defaultValue="OPERATOR" options={ROLE_OPTIONS} />
      <FormMessage state={state} />
      <SubmitButton label="Criar usuário" />
    </form>
  );
}

export function EditUserRow({ user, isSelf }: { user: SafeUser; isSelf: boolean }) {
  const [state, formAction] = useActionState(updateUserAction.bind(null, user.id), {});

  return (
    <form action={formAction} className="grid items-end gap-3 px-5 py-4 sm:grid-cols-[1fr_170px_120px_170px_auto]">
      <div>
        <p className="font-medium text-slate-900">
          {user.name} {isSelf && <span className="text-xs text-slate-500">(você)</span>}
        </p>
        <p className="text-xs text-slate-500">{user.email}</p>
      </div>
      <div>
        <label htmlFor={`role-${user.id}`} className="sr-only">
          Papel
        </label>
        <select id={`role-${user.id}`} name="role" defaultValue={user.role} disabled={isSelf} className="input">
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {isSelf && <input type="hidden" name="role" value={user.role} />}
      </div>
      <div>
        <label htmlFor={`active-${user.id}`} className="sr-only">
          Situação
        </label>
        <select id={`active-${user.id}`} name="active" defaultValue={String(user.active)} disabled={isSelf} className="input">
          <option value="true">Ativo</option>
          <option value="false">Inativo</option>
        </select>
        {isSelf && <input type="hidden" name="active" value="true" />}
      </div>
      <div>
        <label htmlFor={`pw-${user.id}`} className="sr-only">
          Nova senha
        </label>
        <input
          id={`pw-${user.id}`}
          name="password"
          type="password"
          minLength={8}
          placeholder="Nova senha (opcional)"
          autoComplete="new-password"
          className="input"
        />
      </div>
      <div className="flex items-center gap-2">
        <SubmitButton label="Salvar" size="sm" variant="secondary" />
      </div>
      {(state.error || state.success) && (
        <div className="sm:col-span-5">
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}
