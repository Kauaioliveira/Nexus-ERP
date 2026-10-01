import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelSaleDto {
  @IsString()
  @MinLength(3, { message: 'Informe o motivo do cancelamento.' })
  @MaxLength(500)
  reason!: string;
}
