'use client';

import { useActionState, useState } from 'react';
import { createMovementAction } from '@/actions/stock';
import { barcodeLookupAction } from '@/actions/products';
import { CameraScanButton } from '@/components/scan/CameraScanner';
import { type PosProduct, searchProductsAction } from '@/actions/sales';
import { FormMessage } from '@/components/ui/FormMessage';
import { SubmitButton } from '@/components/ui/SubmitButton';
import type { MovementType } from '@/lib/types';
import { useSearch } from '@/lib/use-search';

export function MovementForm() {
  const [state, formAction] = useActionState(createMovementAction, {});
  const [term, setTerm] = useState('');
  const [product, setProduct] = useState<PosProduct | null>(null);
  const [type, setType] = useState<MovementType>('ENTRADA');

  const [notFound, setNotFound] = useState<string | null>(null);

  const { results } = useSearch(searchProductsAction, product ? '' : term);

  // Leitor USB (Enter) ou camera: seleciona o produto pelo codigo exato.
  async function selectByCode(raw: string) {
    const code = raw.trim();
    if (!code) return;
    setNotFound(null);
    const lookup = await barcodeLookupAction(code);
    if (lookup?.product) {
      setProduct({
        id: lookup.product.id,
        name: lookup.product.name,
        sku: lookup.product.sku,
        barcode: lookup.product.barcode,
        unit: lookup.product.unit,
        salePrice: Number(lookup.product.salePrice),
        costPrice: Number(lookup.product.costPrice),
        currentStock: lookup.product.currentStock,
      });
      setTerm('');
    } else if (results.length === 1) {
      setProduct(results[0]);
    } else {
      setTerm(code);
      setNotFound(code);
    }
  }

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <h2 className="font-semibold text-slate-900">Registrar movimentação</h2>
      <p className="text-xs text-slate-500">
        Para compras de fornecedor, prefira um pedido de compra (atualiza custo e contas a pagar).
        Use esta tela para perdas, consumo interno e acertos de inventário.
      </p>

      <div className="relative">
        <label htmlFor="mv-product" className="label">
          Produto <span className="text-red-500">*</span>
        </label>
        <input type="hidden" name="productId" value={product?.id ?? ''} />
        <div className="mt-1 flex gap-2">
          <input
            id="mv-product"
            value={product ? `${product.name} (estoque ${product.currentStock})` : term}
            onChange={(event) => {
              setProduct(null);
              setNotFound(null);
              setTerm(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (!product) void selectByCode(term);
              }
            }}
            placeholder="Nome, SKU ou código de barras"
            autoComplete="off"
            className="input"
          />
          <CameraScanButton label="" onDetected={(code) => void selectByCode(code)} />
        </div>
        {notFound && (
          <p className="mt-1 text-xs text-amber-700" role="alert">
            Nenhum produto com o código {notFound}.
          </p>
        )}
        {results.length > 0 && !notFound && (
          <ul className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {results.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => {
                    setProduct(option);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-brand-50"
                >
                  {option.name} <span className="text-xs text-slate-500">({option.sku} · estoque {option.currentStock})</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="mv-type" className="label">
            Tipo
          </label>
          <select
            id="mv-type"
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as MovementType)}
            className="input mt-1"
          >
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída (perda, consumo)</option>
            <option value="AJUSTE">Ajuste de inventário</option>
          </select>
        </div>
        <div>
          <label htmlFor="mv-qty" className="label">
            Quantidade <span className="text-red-500">*</span>
          </label>
          <input id="mv-qty" name="quantity" type="number" min={1} required className="input mt-1" />
        </div>
      </div>

      {type === 'AJUSTE' && (
        <fieldset className="flex gap-4 text-sm">
          <legend className="label mb-1">Direção do ajuste</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="direction" value="up" defaultChecked /> Aumentar saldo
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="direction" value="down" /> Reduzir saldo
          </label>
        </fieldset>
      )}

      {type === 'ENTRADA' && (
        <div>
          <label htmlFor="mv-cost" className="label">
            Custo unitário (R$)
          </label>
          <input id="mv-cost" name="unitCost" inputMode="decimal" className="input mt-1" placeholder="Opcional" />
        </div>
      )}

      <div>
        <label htmlFor="mv-reason" className="label">
          Motivo
        </label>
        <input id="mv-reason" name="reason" className="input mt-1" placeholder="Ex.: produto avariado" />
      </div>

      <FormMessage state={state} />
      <SubmitButton label="Registrar" />
    </form>
  );
}
