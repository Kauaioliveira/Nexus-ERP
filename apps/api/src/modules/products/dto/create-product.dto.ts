import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Aceita "2202.10.00" ou "22021000": guarda so os digitos.
const digitsOnly = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D/g, '') || undefined : value;

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  sku!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  barcode?: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salePrice!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  // Dados fiscais (NF-e/NFC-e).
  @IsOptional()
  @Transform(digitsOnly)
  @Matches(/^\d{8}$/, { message: 'NCM deve ter 8 dígitos.' })
  ncm?: string;

  @IsOptional()
  @Transform(digitsOnly)
  @Matches(/^\d{7}$/, { message: 'CEST deve ter 7 dígitos.' })
  cest?: string;

  @IsOptional()
  @Matches(/^[56]\d{3}$/, { message: 'CFOP de saída deve começar com 5 (dentro do estado) ou 6.' })
  cfop?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8)
  origin?: number;

  // Simples Nacional: 102 tributada sem credito, 103 isencao por faixa,
  // 300 imune, 400 nao tributada, 500 ICMS ja cobrado por ST.
  @IsOptional()
  @IsIn(['102', '103', '300', '400', '500'])
  csosn?: string;
}
