'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Atualiza a pagina enquanto a nota esta na fila/sendo autorizada, para o
// status mudar sozinho na tela (a emissao e assincrona).
export function AutoRefresh({ active, intervalMs = 1500, maxTries = 20 }: { active: boolean; intervalMs?: number; maxTries?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      router.refresh();
      if (tries >= maxTries) clearInterval(timer);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, maxTries, router]);

  return null;
}
