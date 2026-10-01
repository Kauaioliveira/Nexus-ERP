import { BadRequestException, Injectable } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements-query.dto';
import { applyStockDelta } from './stock-balance';

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStockMovementDto, userId: string) {
    const delta = this.resolveDelta(dto.type, dto.quantity);

    return this.prisma.$transaction(async (tx) => {
      // Aplica o saldo antes de gravar a movimentacao: se o estoque for
      // insuficiente (ou o produto nao existir), nada e persistido.
      await applyStockDelta(tx, dto.productId, delta);

      return tx.stockMovement.create({
        data: {
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          unitCost: dto.unitCost,
          productId: dto.productId,
          userId,
        },
      });
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
