import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

// Condicao de pagamento combinada com o fornecedor, informada no
// recebimento (quando chega a nota do fornecedor).
export class ReceivePurchaseOrderDto {
  // Vencimento da primeira parcela; padrao: 30 dias apos o recebimento.
  @IsOptional()
  @IsDateString()
  firstDueDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  installments?: number;
}
