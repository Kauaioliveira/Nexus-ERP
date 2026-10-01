import { PaymentMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class PayFinancialEntryDto {
  // Data do pagamento; padrao: agora.
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
