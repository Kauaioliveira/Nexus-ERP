'use client';

import { useActionState, useState } from 'react';
import { createEntryAction } from '@/actions/finance';
import { Field, SelectField, TextArea } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/FormMessage';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { PAYMENT_METHOD_LABELS, todayInput } from '@/lib/format';

const CATEGORIES = [
  'Aluguel',
  'Energia',
  'Água',
  'Internet e telefone',
  'Salários',
  'Impostos',
  'Fornecedores',
  'Manutenção',
  'Marketing',
  'Vendas',
  'Outros',
];

export function EntryForm({ defaultType }: { defaultType: 'RECEIVABLE' | 'PAYABLE' }) {
  const [state, formAction] = useActionState(createEntryAction, {});
  const [paid, setPaid] = useState(false);

  return (
    <form action={formAction} className="card grid max-w-3xl gap-4 p-6 sm:grid-cols-2">
      <SelectField
        label="Tipo"
        name="type"
        defaultValue={defaultType}
        required
        options={[
          { value: 'PAYABLE', label: 'Conta a pagar (despesa)' },
          { value: 'RECEIVABLE', label: 'Conta a receber (receita)' },
        ]}
      />
      <div>
        <label htmlFor="category" className="label">
          Categoria
        </label>
        <input id="category" name="category" list="categories" className="input mt-1" />
        <datalist id="categories">
          {CATEGORIES.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </div>
      <Field label="Descrição" name="description" required minLength={2} className="sm:col-span-2" placeholder="Ex.: Aluguel de outubro" />
      <Field label="Valor total (R$)" name="amount" inputMode="decimal" required placeholder="0,00" />
      <SelectField
        label="Parcelas"
        name="installments"
        defaultValue="1"
        options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}x` }))}
      />
      <Field label="Vencimento (1ª parcela)" name="dueDate" type="date" defaultValue={todayInput()} required />
      <div className="flex items-end gap-3 pb-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="paid" checked={paid} onChange={(event) => setPaid(event.target.checked)} />
          Já está pago
        </label>
      </div>
      {paid && (
        <SelectField
          label="Forma de pagamento"
          name="paymentMethod"
          defaultValue="PIX"
          options={Object.entries(PAYMENT_METHOD_LABELS)
            .filter(([value]) => value !== 'A_PRAZO')
            .map(([value, label]) => ({ value, label }))}
        />
      )}
      <TextArea label="Observações" name="notes" className="sm:col-span-2" rows={2} />
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton label="Lançar" />
      </div>
    </form>
  );
}
