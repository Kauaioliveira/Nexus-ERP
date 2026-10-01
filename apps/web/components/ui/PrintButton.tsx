'use client';

import { Printer } from 'lucide-react';

export function PrintButton({ label = 'Imprimir' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary">
      <Printer className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
