import { Prisma } from '@prisma/client';

type Amount = number | string | Prisma.Decimal;

// Valores monetarios sao somados em centavos (inteiros) para evitar erros
// de ponto flutuante como 0.1 + 0.2 = 0.30000000000000004.
export function toCents(value: Amount): number {
  return Math.round(Number(value) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

// Divide um total em N parcelas de centavos inteiros. A diferenca de
// arredondamento vai para a primeira parcela, para que a soma bata sempre
// com o total (ex.: 100,00 em 3x = 33,34 + 33,33 + 33,33).
export function splitInstallments(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => (index === 0 ? base + remainder : base));
}
