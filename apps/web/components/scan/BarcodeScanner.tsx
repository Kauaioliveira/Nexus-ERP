'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Html5Qrcode } from 'html5-qrcode';
import { lookupProductByCodeAction } from '@/actions/products';
import type { ScannedProduct } from '@/actions/products';

type ScanState =
  | { status: 'starting' }
  | { status: 'scanning' }
  | { status: 'camera-unavailable' }
  | { status: 'looking-up'; code: string }
  | { status: 'found'; code: string; product: ScannedProduct }
  | { status: 'not-found'; code: string };

const READER_ELEMENT_ID = 'barcode-reader';

export function BarcodeScanner() {
  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const [state, setState] = useState<ScanState>({ status: 'starting' });
  const [manualCode, setManualCode] = useState('');

  async function handleCode(decodedText: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setState({ status: 'looking-up', code: decodedText });

    const product = await lookupProductByCodeAction(decodedText);
    setState(product ? { status: 'found', code: decodedText, product } : { status: 'not-found', code: decodedText });

    setTimeout(() => {
      busyRef.current = false;
    }, 1500);
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualCode.trim()) return;
    void handleCode(manualCode.trim());
  }

  useEffect(() => {
    let cancelled = false;

    async function start() {
      // Import dinamico: a biblioteca acessa APIs de navegador (camera,
      // MediaDevices) que nao existem durante a renderizacao no servidor.
      const { Html5Qrcode } = await import('html5-qrcode');
      if (cancelled) return;

      const scanner = new Html5Qrcode(READER_ELEMENT_ID);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            void handleCode(decodedText);
          },
          () => {
            // Falha ao decodificar um unico frame - esperado enquanto o
            // usuario posiciona o codigo, nao precisa de tratamento.
          },
        );
        if (!cancelled) setState({ status: 'scanning' });
      } catch {
        // Sem camera disponivel ou permissao negada: o formulario de
        // digitacao manual abaixo continua funcionando normalmente, entao
        // isso nao e um erro fatal, so um estado informativo.
        if (!cancelled) setState({ status: 'camera-unavailable' });
      }
    }

    start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {
            // camera pode ja ter sido liberada - seguro ignorar
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div
        id={READER_ELEMENT_ID}
        role="img"
        aria-label="Visualizacao da camera para leitura de codigo de barras ou QR"
        className="mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-black"
      />

      {state.status === 'camera-unavailable' && (
        <p className="text-center text-sm text-slate-500">
          Camera indisponivel neste dispositivo. Digite o codigo manualmente abaixo.
        </p>
      )}

      <form onSubmit={handleManualSubmit} className="mx-auto flex max-w-sm gap-2">
        <div className="flex-1">
          <label htmlFor="manual-code" className="sr-only">
            Digitar codigo de barras ou SKU manualmente
          </label>
          <input
            id="manual-code"
            type="text"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            placeholder="Ou digite o codigo aqui"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Buscar
        </button>
      </form>

      <div aria-live="polite" className="space-y-4">
        {state.status === 'starting' && <p className="text-center text-sm text-slate-500">Iniciando camera...</p>}

        {state.status === 'looking-up' && (
          <p className="text-center text-sm text-slate-500">Buscando produto para o codigo {state.code}...</p>
        )}

        {state.status === 'found' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-sm text-emerald-700">
              Encontrado: <strong>{state.product.name}</strong> (SKU {state.product.sku})
            </p>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/products/${state.product.id}`)}
              className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Abrir produto
            </button>
          </div>
        )}

        {state.status === 'not-found' && (
          <p className="text-center text-sm text-amber-700" role="alert">
            Nenhum produto encontrado para o codigo {state.code}.
          </p>
        )}
      </div>
    </div>
  );
}
