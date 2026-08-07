import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements-query.dto';

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStockMovementDto, userId: string) {
    const delta = this.resolveDelta(dto.type, dto.quantity);

    // NOTA: para o volume de uma unica loja, uma transacao interativa e
    // suficiente. Em um cenario de alta concorrencia sobre o mesmo produto,
    // o ideal seria um SELECT ... FOR UPDATE (via $queryRaw) para evitar
    // race conditions entre leitura e escrita do saldo.
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: dto.productId } });

      if (!product || !product.active) {
        throw new NotFoundException('Produto nao encontrado.');
      }

      const newStock = product.currentStock + delta;
      if (newStock < 0) {
        throw new BadRequestException(
          `Estoque insuficiente: saldo atual e ${product.currentStock}, movimentacao pede ${Math.abs(delta)}.`,
        );
      }

      const movement = await tx.stockMovement.create({
        data: {
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          unitCost: dto.unitCost,
          productId: dto.productId,
          userId,
        },
      });

      await tx.product.update({
        where: { id: dto.productId },
        data: { currentStock: newStock },
      });

      return movement;
    });
  }

  async findAll(query: ListStockMovementsQueryDto) {
    const { page, pageSize, productId, type } = query;

    const where: Prisma.StockMovementWhereInput = {
      ...(productId && { productId }),
      ...(type && { type }),
    };

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, sku: true, name: true } },
          user: { select: { id: true, name: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  private resolveDelta(type: MovementType, quantity: number): number {
    switch (type) {
      case MovementType.ENTRADA:
        if (quantity <= 0) {
          throw new BadRequestException('Quantidade de entrada deve ser positiva.');
        }
        return quantity;

      case MovementType.SAIDA:
        if (quantity <= 0) {
          throw new BadRequestException('Quantidade de saida deve ser positiva.');
        }
        return -quantity;

      case MovementType.AJUSTE:
        // Delta assinado: positivo corrige para cima, negativo para baixo.
        return quantity;

      default:
        throw new BadRequestException('Tipo de movimentacao invalido.');
    }
  }
}
