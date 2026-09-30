'use client';

import { useActionState } from 'react';
import { receivePurchaseOrderAction } from '@/actions/purchases';
import { FormMessage } from '@/components/ui/FormMessage';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { todayInput } from '@/lib/format';
import type { ActionState } from '@/lib/types';

export function ReceivePurchaseForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    receivePurchaseOrderAction.bind(null, orderId),
    {},
  );

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold text-slate-900">Receber mercadoria</h2>
        <p className="mt-1 text-sm text-slate-500">
          Confira os itens que chegaram. O recebimento dá entrada no estoque, atualiza o custo médio
          e lança as contas a pagar ao fornecedor.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="installments" className="label">
            Parcelas
          </label>
          <select id="installments" name="installments" defaultValue="1" className="input mt-1">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}x
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="firstDueDate" className="label">
            1º vencimento
          </label>
          <input
            id="firstDueDate"
            name="firstDueDate"
            type="date"
            defaultValue={todayInput(30)}
            className="input mt-1"
          />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton label="Confirmar recebimento" pendingLabel="Recebendo..." />
    </form>
  );
}
