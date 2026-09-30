'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, useTransition } from 'react';
import { Minus, Plus, Search, Trash2, UserRound, X } from 'lucide-react';
import {
  createSaleAction,
  type PosProduct,
  searchCustomersAction,
  searchProductsAction,
} from '@/actions/sales';
import {
  DEFERRED_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  formatMoney,
  todayInput,
} from '@/lib/format';
import type { PaymentMethod } from '@/lib/types';
import { useSearch } from '@/lib/use-search';

interface CartLine {
  product: PosProduct;
  quantity: number;
}

type CustomerOption = Awaited<ReturnType<typeof searchCustomersAction>>[number];

const toCents = (value: number) => Math.round(value * 100);

export function PointOfSale() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [productTerm, setProductTerm] = useState('');
  const [customerTerm, setCustomerTerm] = useState('');
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('DINHEIRO');
  const [discount, setDiscount] = useState('');
  const [installments, setInstallments] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState(todayInput(30));
  const [cashReceived, setCashReceived] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const products = useSearch(searchProductsAction, productTerm);
  const customers = useSearch(searchCustomersAction, customer ? '' : customerTerm);

  const deferred = DEFERRED_PAYMENT_METHODS.includes(paymentMethod);
  const subtotalCents = useMemo(
    () => cart.reduce((sum, line) => sum + toCents(line.product.salePrice) * line.quantity, 0),
    [cart],
  );
  const discountCents = toCents(Number(discount.replace(',', '.')) || 0);
  const totalCents = Math.max(subtotalCents - discountCents, 0);
  const changeCents = toCents(Number(cashReceived.replace(',', '.')) || 0) - totalCents;

  function addProduct(product: PosProduct) {
    setError(null);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
    setProductTerm('');
    searchRef.current?.focus();
  }

  function setQuantity(productId: string, quantity: number) {
    setCart((current) =>
      current
        .map((line) => (line.product.id === productId ? { ...line, quantity } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  // Enter na busca: com um leitor de codigo de barras (que "digita" o
  // codigo e aperta Enter), o produto cai direto no carrinho.
  async function handleSearchEnter() {
    const term = productTerm.trim();
    if (!term) return;
    const found = products.results.length > 0 ? products.results : await searchProductsAction(term);
    const exact = found.find((p) => p.barcode === term || p.sku.toLowerCase() === term.toLowerCase());
    const pick = exact ?? (found.length === 1 ? found[0] : undefined);
    if (pick) addProduct(pick);
    else if (found.length === 0) setError(`Nenhum produto encontrado para "${term}".`);
  }

  function finish() {
    setError(null);
    if (cart.length === 0) {
      setError('Adicione pelo menos um produto.');
      return;
    }
    if (paymentMethod === 'A_PRAZO' && !customer) {
      setError('Venda a prazo precisa de um cliente. Busque ou cadastre o cliente.');
      return;
    }
    const overStock = cart.find((line) => line.quantity > line.product.currentStock);
    if (overStock) {
      setError(
        `Estoque insuficiente para "${overStock.product.name}" (disponível: ${overStock.product.currentStock}).`,
      );
      return;
    }

    startTransition(async () => {
      const result = await createSaleAction({
        items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        customerId: customer?.id,
        paymentMethod,
        discount: discountCents > 0 ? discountCents / 100 : undefined,
        installments: deferred ? installments : undefined,
        firstDueDate: deferred ? firstDueDate : undefined,
        notes: notes.trim() || undefined,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-4" aria-label="Itens da venda">
        <div className="card relative p-4">
          <label htmlFor="pos-search" className="label">
            Adicionar produto
          </label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              id="pos-search"
              ref={searchRef}
              autoFocus
              autoComplete="off"
              value={productTerm}
              onChange={(event) => {
                setProductTerm(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSearchEnter();
                }
              }}
              placeholder="Nome, SKU ou código de barras (Enter adiciona)"
              className="input pl-9"
            />
          </div>
          {productTerm && (
            <ul className="absolute left-4 right-4 z-10 mt-1 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {products.loading && products.results.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">Buscando...</li>
              )}
              {!products.loading && products.results.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">Nenhum produto encontrado.</li>
              )}
              {products.results.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(product)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left hover:bg-brand-50"
                  >
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{product.name}</span>
                      <span className="text-xs text-slate-500">
                        {product.sku} · estoque {product.currentStock} {product.unit}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatMoney(product.salePrice)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th scope="col" className="px-4 py-3">Produto</th>
                <th scope="col" className="px-4 py-3 text-center">Qtd.</th>
                <th scope="col" className="px-4 py-3 text-right">Unitário</th>
                <th scope="col" className="px-4 py-3 text-right">Total</th>
                <th scope="col" className="px-2 py-3"><span className="sr-only">Remover</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cart.map((line) => (
                <tr key={line.product.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{line.product.name}</p>
                    <p className="text-xs text-slate-500">{line.product.sku}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQuantity(line.product.id, line.quantity - 1)}
                        className="rounded-md border border-slate-300 p-1 hover:bg-slate-50"
                        aria-label={`Diminuir quantidade de ${line.product.name}`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(event) =>
                          setQuantity(line.product.id, Math.max(0, Number(event.target.value) || 0))
                        }
                        className="w-14 rounded-md border border-slate-300 px-1 py-1 text-center text-sm"
                        aria-label={`Quantidade de ${line.product.name}`}
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                        className="rounded-md border border-slate-300 p-1 hover:bg-slate-50"
                        aria-label={`Aumentar quantidade de ${line.product.name}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {line.quantity > line.product.currentStock && (
                      <p className="mt-1 text-center text-xs text-red-600">
                        Só há {line.product.currentStock} em estoque
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatMoney(line.product.salePrice)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {formatMoney((toCents(line.product.salePrice) * line.quantity) / 100)}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setQuantity(line.product.id, 0)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remover ${line.product.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                    Carrinho vazio. Busque um produto ou passe o leitor de código de barras.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="space-y-4" aria-label="Pagamento">
        <div className="card space-y-4 p-4">
          <div className="relative">
            <label htmlFor="pos-customer" className="label">
              Cliente {paymentMethod === 'A_PRAZO' ? <span className="text-red-500">*</span> : '(opcional)'}
            </label>
            {customer ? (
              <div className="mt-1 flex items-center justify-between rounded-lg border border-brand-100 bg-brand-50 px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-medium text-brand-700">
                  <UserRound className="h-4 w-4" aria-hidden />
                  {customer.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomer(null);
                    setCustomerTerm('');
                  }}
                  className="rounded p-1 text-brand-700 hover:bg-brand-100"
                  aria-label="Remover cliente"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <input
                  id="pos-customer"
                  autoComplete="off"
                  value={customerTerm}
                  onChange={(event) => setCustomerTerm(event.target.value)}
                  placeholder="Buscar por nome, CPF ou telefone"
                  className="input mt-1"
                />
                {customerTerm && (
                  <ul className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {customers.results.map((option) => (
                      <li key={option.id}>
                        <button
                          type="button"
                          onClick={() => setCustomer(option)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-brand-50"
                        >
                          <span className="font-medium text-slate-900">{option.name}</span>
                          <span className="block text-xs text-slate-500">
                            {[option.document, option.phone].filter(Boolean).join(' · ') || 'Sem documento'}
                          </span>
                        </button>
                      </li>
                    ))}
                    {!customers.loading && customers.results.length === 0 && (
                      <li className="px-3 py-2 text-sm text-slate-500">
                        Nenhum cliente.{' '}
                        <Link href="/dashboard/customers/new" target="_blank" className="text-brand-700 underline">
                          Cadastrar
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            <label htmlFor="pos-payment" className="label">
              Forma de pagamento
            </label>
            <select
              id="pos-payment"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
              className="input mt-1"
            >
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {deferred && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pos-installments" className="label">
                  Parcelas
                </label>
                <select
                  id="pos-installments"
                  value={installments}
                  onChange={(event) => setInstallments(Number(event.target.value))}
                  className="input mt-1"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x {totalCents > 0 && `de ${formatMoney(totalCents / 100 / n)}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pos-due" className="label">
                  1º vencimento
                </label>
                <input
                  id="pos-due"
                  type="date"
                  value={firstDueDate}
                  onChange={(event) => setFirstDueDate(event.target.value)}
                  className="input mt-1"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pos-discount" className="label">
                Desconto (R$)
              </label>
              <input
                id="pos-discount"
                inputMode="decimal"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                placeholder="0,00"
                className="input mt-1"
              />
            </div>
            {paymentMethod === 'DINHEIRO' && (
              <div>
                <label htmlFor="pos-cash" className="label">
                  Valor recebido
                </label>
                <input
                  id="pos-cash"
                  inputMode="decimal"
                  value={cashReceived}
                  onChange={(event) => setCashReceived(event.target.value)}
                  placeholder="0,00"
                  className="input mt-1"
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="pos-notes" className="label">
              Observações
            </label>
            <input
              id="pos-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="input mt-1"
              maxLength={1000}
            />
          </div>
        </div>

        <div className="card space-y-2 p-4">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span>{formatMoney(subtotalCents / 100)}</span>
          </div>
          {discountCents > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>Desconto</span>
              <span>- {formatMoney(discountCents / 100)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-slate-100 pt-2">
            <span className="text-sm font-medium text-slate-700">Total</span>
            <span className="text-3xl font-semibold tracking-tight text-slate-900">
              {formatMoney(totalCents / 100)}
            </span>
          </div>
          {paymentMethod === 'DINHEIRO' && cashReceived && (
            <div
              className={`flex justify-between text-sm font-medium ${changeCents >= 0 ? 'text-emerald-700' : 'text-red-600'}`}
            >
              <span>{changeCents >= 0 ? 'Troco' : 'Falta'}</span>
              <span>{formatMoney(Math.abs(changeCents) / 100)}</span>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={finish}
            disabled={pending || cart.length === 0}
            className="btn-primary w-full py-3 text-base"
          >
            {pending ? 'Finalizando...' : 'Finalizar venda'}
          </button>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setCart([]);
                setDiscount('');
                setCashReceived('');
                setError(null);
              }}
              className="btn-secondary w-full"
            >
              Limpar carrinho
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
