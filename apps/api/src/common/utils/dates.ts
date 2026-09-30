// Datas de vencimento sao gravadas ao meio-dia UTC: assim o dia nao
// "escorrega" para o anterior quando exibido em fusos como o de Brasilia
// (UTC-3), o que aconteceria se fossem gravadas a meia-noite UTC.
export function toDueDate(value?: string | Date): Date {
  const source = value ? new Date(value) : new Date();
  return new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate(), 12, 0, 0),
  );
}

// Soma meses mantendo o dia quando possivel; se o mes de destino for mais
// curto (ex.: 31/01 + 1 mes), usa o ultimo dia desse mes.
export function addMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDayOfTarget);
  return new Date(
    Date.UTC(year, month, day, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function startOfUtcDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Fuso do negocio para agrupar e filtrar por "dia" (relatorios, vencidos,
// caixa do dia). O Brasil nao tem mais horario de verao, entao Brasilia e
// sempre UTC-3.
export const BUSINESS_UTC_OFFSET_HOURS = -3;
const OFFSET_SUFFIX = '-03:00';

// Dia local (AAAA-MM-DD) de um instante.
export function toLocalDay(date: Date = new Date()): string {
  return new Date(date.getTime() + BUSINESS_UTC_OFFSET_HOURS * 3_600_000)
    .toISOString()
    .slice(0, 10);
}

export function localDayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000${OFFSET_SUFFIX}`);
}

export function localDayEnd(day: string): Date {
  return new Date(`${day}T23:59:59.999${OFFSET_SUFFIX}`);
}

export function startOfLocalMonth(date: Date = new Date()): string {
  return `${toLocalDay(date).slice(0, 7)}-01`;
}
