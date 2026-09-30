import { IsISO8601, IsOptional } from 'class-validator';

// Periodo analisado (AAAA-MM-DD). Padrao: ultimos 30 dias.
export class OverviewQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
