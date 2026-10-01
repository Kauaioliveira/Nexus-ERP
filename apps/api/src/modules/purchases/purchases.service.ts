import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialEntryType, MovementType, Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { addDays, toDueDate } from '../../common/utils/dates';
import { fromCents, toCents } from '../../common/utils/money';
import { buildInstallmentEntries } from '../financial/financial-entries.builder';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders-query.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';

const DEFAULT_TERM_DAYS = 30;

// Custo medio ponderado: o custo do produto passa a refletir o que ja
// havia em estoque somado ao que acabou de chegar, em vez de ser
// simplesmente sobrescrito pelo custo da ultima compra.
export function weightedAverageCost(
  currentStock: number,
  currentCost: number,
  receivedQty: number,
  receivedCost: number,
): number {
  const stock = Math.max(currentStock, 0);
  if (stock + receivedQty === 0) return receivedCost;
  const totalCents = stock * toCents(currentCost) + receivedQty * toCents(receivedCost);
  return fromCents(Math.round(totalCents / (stock + receivedQty)));
}

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePurchaseOrderDto, userId: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier || !supplier.active) {
      throw new NotFoundException('Fornecedor nao encontrado.');
    }

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const found = await this.prisma.product.count({
      where: { id: { in: productIds }, active: true },
    });
    if (found !== productIds.length) {
      throw new NotFoundException('Um ou mais produtos do pedido nao foram encontrados.');
    }

    const totalCents = dto.items.reduce(
      (sum, item) => sum + toCents(item.unitCost) * item.quantity,
      0,
    );

    const order = await this.prisma.purchaseOrder.create({
      data: {
        supplierId: dto.supplierId,
        userId,
        total: fromCents(totalCents),
        expectedAt: dto.expectedAt ? toDueDate(dto.expectedAt) : undefined,
        notes: dto.notes,
        items: { create: dto.items },
      },
    });

    return this.findOneOrThrow(order.id);
  }

  async findAll(query: ListPurchaseOrdersQueryDto) {
    const { page, pageSize, status, supplierId } = query;

    const where: Prisma.PurchaseOrderWhereInput = {
      ...(status && { status }),
      ...(supplierId && { supplierId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOneOrThrow(id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, document: true } },
        user: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, sku: true, name: true, unit: true, currentStock: true },
            },
          },
        },
        financialEntries: { orderBy: { installment: 'asc' } },
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido de compra nao encontrado.');
    }

    return order;
  }

  // Recebimento da mercadoria: entrada no estoque, atualizacao do custo
  // medio e geracao das contas a pagar ao fornecedor - tudo ou nada.
  async receive(id: string, dto: ReceivePurchaseOrderDto, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true } });

      if (!order) {
        throw new NotFoundException('Pedido de compra nao encontrado.');
      }

      const updated = await tx.purchaseOrder.updateMany({
        where: { id, status: PurchaseOrderStatus.ORDERED },
        data: { status: PurchaseOrderStatus.RECEIVED, receivedAt: new Date() },
      });

      if (updated.count === 0) {
        throw new BadRequestException('Apenas pedidos em aberto podem ser recebidos.');
      }

      for (const item of order.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new NotFoundException(`Produto ${item.productId} nao encontrado.`);
        }

        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: { increment: item.quantity },
            costPrice: weightedAverageCost(
              product.currentStock,
              Number(product.costPrice),
              item.quantity,
              Number(item.unitCost),
            ),
          },
        });
      }

      await tx.stockMovement.createMany({
        data: order.items.map((item) => ({
          type: MovementType.ENTRADA,
          quantity: item.quantity,
          unitCost: item.unitCost,
          reason: `Recebimento do pedido de compra #${order.number}`,
          productId: item.productId,
          userId,
        })),
      });

      const totalCents = toCents(order.total);
      if (totalCents > 0) {
        await tx.financialEntry.createMany({
          data: buildInstallmentEntries({
            type: FinancialEntryType.PAYABLE,
            description: `Pedido de compra #${order.number}`,
            category: 'Compras',
            totalCents,
            installments: dto.installments ?? 1,
            firstDueDate: toDueDate(dto.firstDueDate ?? addDays(new Date(), DEFAULT_TERM_DAYS)),
            purchaseOrderId: order.id,
            supplierId: order.supplierId,
            userId,
          }),
        });
      }
    });

    return this.findOneOrThrow(id);
  }

  async cancel(id: string) {
    const updated = await this.prisma.purchaseOrder.updateMany({
      where: { id, status: PurchaseOrderStatus.ORDERED },
      data: { status: PurchaseOrderStatus.CANCELLED },
    });

    if (updated.count === 0) {
      await this.findOneOrThrow(id);
      throw new BadRequestException(
        'Apenas pedidos em aberto podem ser cancelados. Para pedidos ja recebidos, faca uma saida/ajuste de estoque.',
      );
    }

    return this.findOneOrThrow(id);
  }
}
