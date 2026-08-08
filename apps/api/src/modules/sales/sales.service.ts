import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FiscalStatus, MovementType, Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FiscalService } from '../fiscal/fiscal.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';

interface SaleLine {
  productId: string;
  quantity: number;
  unitPrice: number;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly fiscalService: FiscalService,
  ) {}

  async create(dto: CreateSaleDto, userId: string) {
    const fiscalProviderName = this.configService.get<string>('FISCAL_PROVIDER') ?? 'sandbox';

    const sale = await this.prisma.$transaction(async (tx) => {
      const lines: SaleLine[] = [];
      let total = 0;

      // Processado sequencialmente (nao em paralelo) de proposito: cada
      // leitura de produto dentro da transacao precisa enxergar as
      // atualizacoes de estoque feitas pelos itens anteriores do mesmo
      // pedido, inclusive quando o mesmo produto aparece mais de uma vez.
      for (const item of dto.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });

        if (!product || !product.active) {
          throw new NotFoundException(`Produto ${item.productId} nao encontrado.`);
        }

        if (product.currentStock < item.quantity) {
          throw new BadRequestException(
            `Estoque insuficiente para "${product.name}": disponivel ${product.currentStock}, pedido ${item.quantity}.`,
          );
        }

        const unitPrice = Number(product.salePrice);
        total += unitPrice * item.quantity;
        lines.push({ productId: product.id, quantity: item.quantity, unitPrice });

        await tx.product.update({
          where: { id: product.id },
          data: { currentStock: product.currentStock - item.quantity },
        });
      }

      const createdSale = await tx.sale.create({
        data: {
          status: SaleStatus.COMPLETED,
          total,
          userId,
          items: { create: lines },
        },
      });

      await Promise.all(
        lines.map((line) =>
          tx.stockMovement.create({
            data: {
              type: MovementType.SAIDA,
              quantity: line.quantity,
              reason: `Venda ${createdSale.id}`,
              productId: line.productId,
              userId,
            },
          }),
        ),
      );

      await tx.fiscalDocument.create({
        data: {
          saleId: createdSale.id,
          provider: fiscalProviderName,
          status: FiscalStatus.QUEUED,
        },
      });

      return createdSale;
    });

    // So enfileira a emissao fiscal depois que a venda foi commitada: uma
    // eventual indisponibilidade do Redis nunca deve impedir a venda em
    // si de ser concluida.
    await this.fiscalService.enqueueEmission(sale.id);

    return this.findOneOrThrow(sale.id);
  }

  async findAll(query: ListSalesQueryDto) {
    const { page, pageSize, status } = query;

    const where: Prisma.SaleWhereInput = { ...(status && { status }) };

    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          fiscalDocument: true,
          user: { select: { id: true, name: true } },
          items: true,
        },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOneOrThrow(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        fiscalDocument: true,
        user: { select: { id: true, name: true } },
      },
    });

    if (!sale) {
      throw new NotFoundException('Venda nao encontrada.');
    }

    return sale;
  }
}
