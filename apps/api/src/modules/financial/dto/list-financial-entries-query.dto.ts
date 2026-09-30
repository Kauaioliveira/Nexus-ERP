import { FinancialEntryStatus, FinancialEntryType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListFinancialEntriesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(FinancialEntryType)
  type?: FinancialEntryType;

  @IsOptional()
  @IsEnum(FinancialEntryStatus)
  status?: FinancialEntryStatus;

  // Somente em aberto com vencimento anterior a hoje.
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdue?: boolean;

  // Intervalo de vencimento (AAAA-MM-DD, dias no fuso de Brasilia).
  @IsOptional()
  @IsISO8601({ strict: true })
  dueFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  dueTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
