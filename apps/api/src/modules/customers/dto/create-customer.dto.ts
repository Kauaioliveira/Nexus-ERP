import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsCpfOrCnpj } from '../../../common/validators/is-cpf-or-cnpj';
import { UF_CODES } from '../../fiscal/nfe/brazil';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @IsCpfOrCnpj()
  document?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // Endereco estruturado: obrigatorio para emitir NF-e para o cliente.
  @IsOptional()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido.' })
  zipCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @IsOptional()
  @Matches(/^\d{7}$/, { message: 'Código IBGE do município deve ter 7 dígitos.' })
  cityCode?: string;

  @IsOptional()
  @IsIn(Object.keys(UF_CODES), { message: 'UF inválida.' })
  state?: string;
}
