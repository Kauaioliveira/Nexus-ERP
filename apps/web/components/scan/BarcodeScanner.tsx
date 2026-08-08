'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Html5Qrcode } from 'html5-qrcode';
import { lookupProductByCodeAction } from '@/actions/products';
import type { ScannedProduct } from '@/actions/products';

type ScanState =
  | { status: 'starting' }
  | { status: 'scanning' }
  | { status: 'looking-up'; code: string }
  | { status: 'found'; code: string; product: ScannedProduct }
  | { status: 'not-found'; code: string }
  | { status: 'error'; message: string };

const READER_ELEMENT_ID = 'barcode-reader';

export function BarcodeScanner() {
  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const [state, setState] = useState<ScanState>({ status: 'starting' });

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
          async (decodedText) => {
            if (busyRef.current) return;
            busyRef.current = true;
            setState({ status: 'looking-up', code: decodedText });

            const product = await lookupProductByCodeAction(decodedText);
            if (!cancelled) {
              setState(
                product
                  ? { status: 'found', code: decodedText, product }
                  : { status: 'not-found', code: decodedText },
              );
            }

            setTimeout(() => {
              busyRef.current = false;
            }, 1500);
          },
          () => {
            // Falha ao decodificar um unico frame - esperado enquanto o
            // usuario posiciona o codigo, nao precisa de tratamento.
          },
        );
        if (!cancelled) setState({ status: 'scanning' });
      } catch {
        if (!cancelled) {
          setState({
            status: 'error',
            message: 'Nao foi possivel acessar a camera. Verifique as permissoes do navegador.',
          });
        }
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
  }, []);

  return (
    <div className="space-y-4">
      <div id={READER_ELEMENT_ID} className="mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-black" />

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
        <p className="text-center text-sm text-amber-600" role="alert">
          Nenhum produto encontrado para o codigo {state.code}.
        </p>
      )}

      {state.status === 'error' && (
        <p className="text-center text-sm text-red-600" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
