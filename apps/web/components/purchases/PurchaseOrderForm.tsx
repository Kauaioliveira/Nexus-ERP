'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createPurchaseOrderAction } from '@/actions/purchases';
import { type PosProduct, searchProductsAction } from '@/actions/sales';
import { formatMoney } from '@/lib/format';
import type { Supplier } from '@/lib/types';
import { useSearch } from '@/lib/use-search';

interface Line {
  key: number;
  product: PosProduct | null;
  quantity: string;
  unitCost: string;
}

// Campo de produto com busca (reaproveita a busca do PDV).
function ProductPicker({
  value,
  onChange,
  inputId,
}: {
  value: PosProduct | null;
  onChange: (product: PosProduct) => void;
  inputId: string;
}) {
  const [term, setTerm] = useState('');
  const { results } = useSearch(searchProductsAction, term);

  if (value) {
    return (
      <p className="py-2 text-sm">
        <span className="font-medium text-slate-900">{value.name}</span>{' '}
        <span className="text-xs text-slate-500">({value.sku} · estoque {value.currentStock})</span>
      </p>
    );
  }

  return (
    <div className="relative">
      <input
        id={inputId}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Buscar produto"
        autoComplete="off"
        className="input"
      />
      {results.length > 0 && (
        <ul className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => onChange(product)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-brand-50"
              >
                {product.name} <span className="text-xs text-slate-500">{product.sku}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

let nextKey = 1;
const emptyLine = (): Line => ({ key: nextKey++, product: null, quantity: '1', unitCost: '' });
const parse = (value: string) => Number(value.replace(',', '.')) || 0;

export function PurchaseOrderForm({
  suppliers,
  defaultSupplierId,
}: {
  suppliers: Supplier[];
  defaultSupplierId?: string;
}) {
  const [supplierId, setSupplierId] = useState(defaultSupplierId ?? '');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const totalCents = lines.reduce(
    (sum, line) => sum + Math.round(parse(line.unitCost) * 100) * Math.max(0, Math.floor(parse(line.quantity))),
    0,
  );

  const update = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const filled = lines.filter((line) => line.product);
    if (!supplierId) return setError('Escolha o fornecedor.');
    if (filled.length === 0) return setError('Adicione pelo menos um produto.');
    if (filled.some((line) => parse(line.quantity) < 1 || !line.unitCost)) {
      return setError('Informe quantidade e custo unitário de todos os itens.');
    }

    startTransition(async () => {
      const result = await createPurchaseOrderAction({
        supplierId,
        items: filled.map((line) => ({
          productId: line.product!.id,
          quantity: Math.floor(parse(line.quantity)),
          unitCost: parse(line.unitCost),
        })),
        expectedAt: expectedAt || undefined,
        notes: notes.trim() || undefined,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label htmlFor="supplierId" className="label">
            Fornecedor <span className="text-red-500">*</span>
          </label>
          <select
            id="supplierId"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            className="input mt-1"
            required
          >
            <option value="">Selecione</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="expectedAt" className="label">
            Previsão de entrega
          </label>
          <input
            id="expectedAt"
            type="date"
            value={expectedAt}
            onChange={(event) => setExpectedAt(event.target.value)}
            className="input mt-1"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="notes" className="label">
            Observações
          </label>
          <input id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="input mt-1" />
        </div>
      </div>

      <div className="card overflow-visible">
        <table className="w-full text-left text-sm">
          <thead className="table-head">
            <tr>
              <th scope="col" className="px-4 py-3">Produto</th>
              <th scope="col" className="w-28 px-4 py-3">Qtd.</th>
              <th scope="col" className="w-36 px-4 py-3">Custo unit. (R$)</th>
              <th scope="col" className="w-32 px-4 py-3 text-right">Total</th>
              <th scope="col" className="w-12 px-2 py-3"><span className="sr-only">Remover</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((line) => (
              <tr key={line.key} className="align-top">
                <td className="px-4 py-3">
                  <ProductPicker
                    inputId={`product-${line.key}`}
                    value={line.product}
                    onChange={(product) =>
                      update(line.key, { product, unitCost: product.costPrice.toFixed(2) })
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(event) => update(line.key, { quantity: event.target.value })}
                    className="input"
                    aria-label="Quantidade"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    inputMode="decimal"
                    value={line.unitCost}
                    onChange={(event) => update(line.key, { unitCost: event.target.value })}
                    placeholder="0,00"
                    className="input"
                    aria-label="Custo unitário"
                  />
                </td>
                <td className="px-4 py-3 pt-5 text-right font-medium">
                  {formatMoney(parse(line.unitCost) * Math.max(0, Math.floor(parse(line.quantity))))}
                </td>
                <td className="px-2 py-3 pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      setLines((current) =>
                        current.length > 1 ? current.filter((item) => item.key !== line.key) : [emptyLine()],
                      )
                    }
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <button type="button" onClick={() => setLines((current) => [...current, emptyLine()])} className="btn-secondary btn-sm">
            <Plus className="h-4 w-4" aria-hidden />
            Adicionar item
          </button>
          <p className="text-sm">
            Total do pedido: <span className="text-lg font-semibold">{formatMoney(totalCents / 100)}</span>
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Salvando...' : 'Criar pedido de compra'}
      </button>
    </form>
  );
}
