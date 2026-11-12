'use client';

import Link from 'next/link';
import { FormEvent, useRef, useState } from 'react';
import { barcodeLookupAction, type BarcodeLookupResult } from '@/actions/products';
import { formatMoney } from '@/lib/format';
import { CameraScanner } from './CameraScanner';

type ScanState =
  | { status: 'idle' }
  | { status: 'looking-up'; code: string }
  | { status: 'done'; result: BarcodeLookupResult }
  | { status: 'error'; code: string };

export function BarcodeScanner({ canCreate }: { canCreate: boolean }) {
  const busyRef = useRef(false);
  const [state, setState] = useState<ScanState>({ status: 'idle' });
  const [manualCode, setManualCode] = useState('');

  async function handleCode(code: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setState({ status: 'looking-up', code });
    const result = await barcodeLookupAction(code);
    setState(result ? { status: 'done', result } : { status: 'error', code });
    busyRef.current = false;
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualCode.trim()) return;
    void handleCode(manualCode.trim());
    setManualCode('');
  }

  const result = state.status === 'done' ? state.result : null;

  return (
    <div className="space-y-4">
      <CameraScanner onDetected={(code) => void handleCode(code)} />

      <form onSubmit={handleManualSubmit} className="mx-auto flex max-w-sm gap-2">
        <div className="flex-1">
          <label htmlFor="manual-code" className="sr-only">
            Digitar código de barras ou SKU
          </label>
          <input
            id="manual-code"
            type="text"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            placeholder="Leitor USB ou digite o código"
            className="input"
            autoFocus
          />
        </div>
        <button type="submit" className="btn-secondary">
          Buscar
        </button>
      </form>

      <div aria-live="polite" className="mx-auto max-w-sm space-y-4">
        {state.status === 'looking-up' && (
          <p className="text-center text-sm text-slate-500">Buscando o código {state.code}...</p>
        )}
        {state.status === 'error' && (
          <p className="text-center text-sm text-amber-700" role="alert">
            Não foi possível consultar o código {state.code}.
          </p>
        )}

        {result?.product && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-800">
            <p>
              <strong>{result.product.name}</strong> · SKU {result.product.sku}
            </p>
            <p className="mt-1">
              {formatMoney(result.product.salePrice)} · estoque {result.product.currentStock} {result.product.unit}
              {!result.product.active && ' · inativo'}
            </p>
            <Link href={`/dashboard/products/${result.product.id}`} className="btn-primary mt-3">
              Abrir produto
            </Link>
          </div>
        )}

        {result && !result.product && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800" role="alert">
            <p>Nenhum produto da loja tem o código {result.code}.</p>
            {result.suggestion && (
              <p className="mt-1">
                Parece ser: <strong>{result.suggestion.name}</strong>
                {result.suggestion.brand && ` (${result.suggestion.brand})`}
              </p>
            )}
            {!result.validGtin && <p className="mt-1">O código não é um GTIN válido.</p>}
            {canCreate && (
              <Link
                href={`/dashboard/products/new?barcode=${encodeURIComponent(result.code)}`}
                className="btn-primary mt-3"
              >
                Cadastrar produto com este código
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
