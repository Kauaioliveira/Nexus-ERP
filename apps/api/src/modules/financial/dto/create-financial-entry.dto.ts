import { FinancialEntryType, PaymentMethod } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Lancamento manual: despesas (aluguel, energia, salarios) e receitas que
// nao vem de uma venda do PDV.
export class CreateFinancialEntryDto {
  @IsEnum(FinancialEntryType)
  type!: FinancialEntryType;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  description!: string;

  // Valor total; com parcelas, e dividido entre elas.
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  installments?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  // Lancar ja quitado (ex.: despesa paga no ato).
  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
