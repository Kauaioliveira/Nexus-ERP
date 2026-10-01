import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaleItemInputDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateSaleDto {
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  @ArrayMinSize(1, { message: 'A venda precisa ter pelo menos um item.' })
  @ArrayMaxSize(200)
  items!: SaleItemInputDto[];

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  // Desconto em reais sobre o subtotal.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount?: number;

  // Parcelas (so para BOLETO e A_PRAZO; cartao de credito parcelado e
  // recebido da operadora, entao entra como pago).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  installments?: number;

  // Vencimento da primeira parcela; padrao: 30 dias apos a venda.
  @IsOptional()
  @IsDateString()
  firstDueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
