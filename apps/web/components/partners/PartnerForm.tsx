'use client';

import { useActionState } from 'react';
import { Field, TextArea } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/FormMessage';
import { SubmitButton } from '@/components/ui/SubmitButton';
import type { ActionState } from '@/lib/types';

interface PartnerValues {
  name?: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export function PartnerForm({
  action,
  values,
  kind,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  values?: PartnerValues;
  kind: 'customer' | 'supplier';
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="card grid gap-4 p-6 sm:grid-cols-2">
      <Field
        label={kind === 'customer' ? 'Nome' : 'Razão social / nome'}
        name="name"
        defaultValue={values?.name}
        required
        minLength={2}
        className="sm:col-span-2"
      />
      <Field
        label={kind === 'customer' ? 'CPF/CNPJ' : 'CNPJ/CPF'}
        name="document"
        defaultValue={values?.document ?? ''}
      />
      <Field label="Telefone" name="phone" type="tel" defaultValue={values?.phone ?? ''} />
      <Field
        label="E-mail"
        name="email"
        type="email"
        defaultValue={values?.email ?? ''}
        className="sm:col-span-2"
      />
      {kind === 'customer' && (
        <>
          <Field
            label="Endereço"
            name="address"
            defaultValue={values?.address ?? ''}
            className="sm:col-span-2"
          />
          <TextArea
            label="Observações"
            name="notes"
            defaultValue={values?.notes}
            className="sm:col-span-2"
          />
        </>
      )}
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
