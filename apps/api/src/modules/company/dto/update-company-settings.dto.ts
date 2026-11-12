import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { UF_CODES } from '../../fiscal/nfe/brazil';

export class UpdateCompanySettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  tradeName?: string;

  @IsOptional()
  @Matches(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/, { message: 'CNPJ inválido.' })
  cnpj?: string;

  @IsOptional()
  @IsString()
  @Length(2, 14)
  stateRegistration?: string;

  // CRT 1 = Simples Nacional, 4 = MEI. O regime normal (3) exigiria
  // calculo de ICMS/PIS/COFINS, que a emulacao ainda nao faz.
  @IsOptional()
  @IsIn([1, 4])
  taxRegime?: number;

  @IsOptional()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido.' })
  zipCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  street?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  number?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  district?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  city?: string;

  @IsOptional()
  @Matches(/^\d{7}$/, { message: 'Código IBGE do município deve ter 7 dígitos.' })
  cityCode?: string;

  @IsOptional()
  @IsIn(Object.keys(UF_CODES))
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(14)
  phone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  nfeSeries?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999_999_999)
  nfeNextNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  nfceSeries?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999_999_999)
  nfceNextNumber?: number;

  @IsOptional()
  @Matches(/^\d{1,6}$/, { message: 'Id do CSC deve ter até 6 dígitos.' })
  cscId?: string;

  @IsOptional()
  @IsString()
  @Length(16, 36)
  cscToken?: string;

  @IsOptional()
  @IsBoolean()
  simulateSefazOffline?: boolean;
}
