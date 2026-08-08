import { Type } from 'class-transformer';
import { ArrayMinSize, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

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
  items!: SaleItemInputDto[];
}
