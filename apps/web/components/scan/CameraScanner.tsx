'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import type { Html5Qrcode } from 'html5-qrcode';

// Leitura de codigo de barras/QR pela camera (celular ou webcam). Chama
// onDetected uma vez por codigo, com uma pausa curta para nao repetir a
// mesma leitura enquanto o produto continua na frente da camera.
export function CameraScanner({
  onDetected,
  onUnavailable,
  className,
}: {
  onDetected: (code: string) => void;
  onUnavailable?: () => void;
  className?: string;
}) {
  const elementId = `reader-${useId().replace(/:/g, '')}`;
  const callbackRef = useRef(onDetected);
  const unavailableRef = useRef(onUnavailable);
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const [status, setStatus] = useState<'starting' | 'scanning' | 'unavailable'>('starting');

  useEffect(() => {
    callbackRef.current = onDetected;
    unavailableRef.current = onUnavailable;
  });

  useEffect(() => {
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    async function start() {
      // Import dinamico: a biblioteca usa APIs de navegador (camera) que
      // nao existem na renderizacao no servidor.
      const { Html5Qrcode } = await import('html5-qrcode');
      if (cancelled) return;
      scanner = new Html5Qrcode(elementId);
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 140 } },
          (decoded) => {
            const now = Date.now();
            const last = lastRef.current;
            if (decoded === last.code && now - last.at < 2500) return;
            lastRef.current = { code: decoded, at: now };
            callbackRef.current(decoded);
          },
          () => {
            // frame sem codigo: esperado enquanto o usuario posiciona
          },
        );
        if (!cancelled) setStatus('scanning');
      } catch {
        // Sem camera ou permissao negada: a digitacao (ou leitor USB)
        // continua funcionando.
        if (!cancelled) {
          setStatus('unavailable');
          unavailableRef.current?.();
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (scanner) {
        const current = scanner;
        current
          .stop()
          .then(() => current.clear())
          .catch(() => {
            // camera ja liberada
          });
      }
    };
  }, [elementId]);

  return (
    <div className={className}>
      <div
        id={elementId}
        role="img"
        aria-label="Visualização da câmera para leitura de código de barras"
        className="mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-black"
      />
      {status === 'starting' && <p className="mt-2 text-center text-sm text-slate-500">Iniciando câmera...</p>}
      {status === 'unavailable' && (
        <p className="mt-2 text-center text-sm text-slate-500">
          Câmera indisponível (sem câmera ou sem permissão). Use o leitor USB ou digite o código.
        </p>
      )}
    </div>
  );
}

// Botao que abre a camera numa janela e devolve o primeiro codigo lido.
export function CameraScanButton({
  onDetected,
  label = 'Câmera',
  continuous = false,
}: {
  onDetected: (code: string) => void;
  label?: string;
  continuous?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)} title="Ler código pela câmera">
        <Camera className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ler código pela câmera"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="card w-full max-w-md space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Aponte para o código de barras</h2>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(false)} aria-label="Fechar">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <CameraScanner
              onDetected={(code) => {
                onDetected(code);
                if (!continuous) setOpen(false);
              }}
            />
            {continuous && (
              <button type="button" className="btn-primary w-full" onClick={() => setOpen(false)}>
                Concluir
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
