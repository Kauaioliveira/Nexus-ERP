import { PaymentMethod, SaleStatus } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListSalesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  // Periodo (AAAA-MM-DD, dias no fuso de Brasilia).
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  // Numero da venda ou nome do cliente.
  @IsOptional()
  @IsString()
  search?: string;
}
