import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Aplica um delta ao saldo de um produto de forma atomica. O saldo e
// atualizado com um UPDATE condicional (`currentStock >= quantidade` para
// saidas) em vez de "ler, calcular e gravar": duas vendas simultaneas do
// ultimo item nunca conseguem deixar o estoque negativo, porque o banco so
// aplica a primeira e a segunda encontra o saldo ja baixado.
export async function applyStockDelta(
  tx: Prisma.TransactionClient,
  productId: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return;

  const result = await tx.product.updateMany({
    where: {
      id: productId,
      active: true,
      ...(delta < 0 && { currentStock: { gte: -delta } }),
    },
    data: { currentStock: { increment: delta } },
  });

  if (result.count === 1) return;

  // Nada foi atualizado: descobre o motivo para devolver um erro claro.
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { name: true, active: true, currentStock: true },
  });

  if (!product || !product.active) {
    throw new NotFoundException(`Produto ${productId} nao encontrado.`);
  }

  throw new BadRequestException(
    `Estoque insuficiente para "${product.name}": disponivel ${product.currentStock}, pedido ${-delta}.`,
  );
}
