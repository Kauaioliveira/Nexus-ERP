'use client';

import { useActionState, useState } from 'react';
import { cancelSaleAction } from '@/actions/sales';
import { FormMessage } from '@/components/ui/FormMessage';
import { SubmitButton } from '@/components/ui/SubmitButton';
import type { ActionState, FiscalModel } from '@/lib/types';

export function CancelSaleForm({
  saleId,
  saleNumber,
  fiscalModel,
}: {
  saleId: string;
  saleNumber: number;
  // Modelo da nota autorizada, quando ha uma (sera cancelada na SEFAZ).
  fiscalModel?: FiscalModel;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    cancelSaleAction.bind(null, saleId),
    {},
  );

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-danger">
        Cancelar venda
      </button>
    );
  }

  return (
    <form action={formAction} className="card w-full space-y-3 border-red-200 p-4 sm:w-96">
      <p className="text-sm text-slate-700">
        Cancelar a venda <strong>#{saleNumber}</strong> devolve os itens ao estoque, cancela as
        parcelas em aberto e lança o estorno do que já foi pago.
      </p>
      {fiscalModel && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          A {fiscalModel === 'NFCE' ? 'NFC-e' : 'NF-e'} autorizada também será cancelada na SEFAZ. O prazo é de{' '}
          {fiscalModel === 'NFCE' ? '30 minutos' : '24 horas'} após a autorização e a justificativa precisa de
          pelo menos 15 caracteres.
        </p>
      )}
      <div>
        <label htmlFor="reason" className="label">
          Motivo <span className="text-red-500">*</span>
        </label>
        <input
          id="reason"
          name="reason"
          required
          minLength={fiscalModel ? 15 : 3}
          maxLength={255}
          className="input mt-1"
        />
      </div>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton label="Confirmar cancelamento" pendingLabel="Cancelando..." variant="danger" />
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Voltar
        </button>
      </div>
    </form>
  );
}
