import { MovementType } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, NotEquals } from 'class-validator';

export class CreateStockMovementDto {
  @IsUUID()
  productId!: string;

  @IsEnum(MovementType)
  type!: MovementType;

  // Para ENTRADA/SAIDA deve ser positivo; para AJUSTE representa o delta
  // (pode ser negativo). A regra de sinal e validada no service, pois
  // depende do valor de `type`.
  @IsInt()
  @NotEquals(0)
  quantity!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  unitCost?: number;
}
