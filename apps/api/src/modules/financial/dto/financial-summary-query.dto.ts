import { IsISO8601, IsOptional } from 'class-validator';

// Periodo do fluxo de caixa (AAAA-MM-DD). Padrao: mes corrente.
export class FinancialSummaryQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
