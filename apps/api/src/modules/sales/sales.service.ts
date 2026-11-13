import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Customer,
  FinancialEntryStatus,
  FinancialEntryType,
  FiscalModel,
  FiscalStatus,
  MovementType,
  PaymentMethod,
  Prisma,
  SaleStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { addDays, localDayEnd, localDayStart, toDueDate } from '../../common/utils/dates';
import { fromCents, toCents } from '../../common/utils/money';
import {
  buildInstallmentEntries,
  isImmediatePayment,
} from '../financial/financial-entries.builder';
import { FISCAL_DOCUMENT_SUMMARY, FiscalService } from '../fiscal/fiscal.service';
import { isValidCpfOrCnpj, onlyDigits } from '../fiscal/nfe/brazil';
import { applyStockDelta } from '../stock-movements/stock-balance';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';

interface SaleLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

const DEFAULT_TERM_DAYS = 30;

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly fiscalService: FiscalService,
  ) {}

  async create(dto: CreateSaleDto, userId: string) {
    const fiscalProviderName = this.configService.get<string>('FISCAL_PROVIDER') ?? 'sandbox';
    const paymentMethod = dto.paymentMethod ?? PaymentMethod.DINHEIRO;
    const immediate = isImmediatePayment(paymentMethod);
    const installments = immediate ? 1 : (dto.installments ?? 1);

    if (paymentMethod === PaymentMethod.A_PRAZO && !dto.customerId) {
      throw new BadRequestException('Venda a prazo precisa de um cliente identificado.');
    }

    const fiscalModel = dto.fiscalModel ?? FiscalModel.NFCE;
    const buyerDocument = dto.buyerDocument ? onlyDigits(dto.buyerDocument) : null;
    if (buyerDocument && !isValidCpfOrCnpj(buyerDocument)) {
      throw new BadRequestException('CPF/CNPJ na nota inválido.');
    }

    const sale = await this.prisma.$transaction(async (tx) => {
      if (dto.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: dto.customerId } });
        if (!customer || !customer.active) {
          throw new NotFoundException('Cliente nao encontrado.');
        }
        if (fiscalModel === FiscalModel.NFE) assertNfeRecipient(customer);
      } else if (fiscalModel === FiscalModel.NFE) {
        throw new BadRequestException(
          'NF-e precisa de um cliente com CPF/CNPJ e endereço completo.',
        );
      }

      const lines: SaleLine[] = [];
      let subtotalCents = 0;

      for (const item of dto.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });

        if (!product || !product.active) {
          throw new NotFoundException(`Produto ${item.productId} nao encontrado.`);
        }

        // Baixa atomica: se outra venda levar o estoque antes, esta falha
        // aqui e a transacao inteira e desfeita.
        await applyStockDelta(tx, product.id, -item.quantity);

        subtotalCents += toCents(product.salePrice) * item.quantity;
        lines.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: Number(product.salePrice),
          unitCost: Number(product.costPrice),
        });
      }

      const discountCents = toCents(dto.discount ?? 0);
      if (discountCents > subtotalCents) {
        throw new BadRequestException('O desconto nao pode ser maior que o subtotal da venda.');
      }
      const totalCents = subtotalCents - discountCents;

      const createdSale = await tx.sale.create({
        data: {
          status: SaleStatus.COMPLETED,
          paymentMethod,
          subtotal: fromCents(subtotalCents),
          discount: fromCents(discountCents),
          total: fromCents(totalCents),
          notes: dto.notes,
          customerId: dto.customerId,
          userId,
          items: { create: lines },
        },
      });

      await tx.stockMovement.createMany({
        data: lines.map((line) => ({
          type: MovementType.SAIDA,
          quantity: line.quantity,
          reason: `Venda #${createdSale.number}`,
          productId: line.productId,
          userId,
        })),
      });

      if (totalCents > 0) {
        await tx.financialEntry.createMany({
          data: buildInstallmentEntries({
            type: FinancialEntryType.RECEIVABLE,
            description: `Venda #${createdSale.number}`,
            category: 'Vendas',
            totalCents,
            installments,
            firstDueDate: immediate
              ? new Date()
              : toDueDate(dto.firstDueDate ?? addDays(new Date(), DEFAULT_TERM_DAYS)),
            paymentMethod,
            paidAt: immediate ? new Date() : undefined,
            saleId: createdSale.id,
            customerId: dto.customerId,
            userId,
          }),
        });
      }

      await tx.fiscalDocument.create({
        data: {
          saleId: createdSale.id,
          provider: fiscalProviderName,
          model: fiscalModel,
          buyerDocument: fiscalModel === FiscalModel.NFCE ? buyerDocument : null,
          status: FiscalStatus.QUEUED,
        },
      });

      return createdSale;
    });

    // So enfileira a emissao fiscal depois que a venda foi commitada. Se o
    // Redis estiver fora, a venda continua valida: a NF-e fica QUEUED e pode
    // ser reenviada depois (POST /sales/:id/fiscal/retry).
    await this.enqueueFiscalSafely(sale.id);

    return this.findOneOrThrow(sale.id);
  }

  async findAll(query: ListSalesQueryDto) {
    const { page, pageSize, status, paymentMethod, customerId, from, to, search } = query;
    const searchNumber = search && /^\d+$/.test(search.trim()) ? Number(search.trim()) : undefined;

    const where: Prisma.SaleWhereInput = {
      ...(status && { status }),
      ...(paymentMethod && { paymentMethod }),
      ...(customerId && { customerId }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: localDayStart(from) }),
          ...(to && { lte: localDayEnd(to) }),
        },
      }),
      ...(search &&
        (searchNumber !== undefined
          ? { number: searchNumber }
          : { customer: { name: { contains: search, mode: 'insensitive' } } })),
    };

    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          fiscalDocument: { select: FISCAL_DOCUMENT_SUMMARY },
          user: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
          _count: { select: { items: true } },
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
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                barcode: true,
                name: true,
                unit: true,
                ncm: true,
                cfop: true,
                csosn: true,
              },
            },
          },
        },
        fiscalDocument: { select: FISCAL_DOCUMENT_SUMMARY },
        user: { select: { id: true, name: true } },
        customer: {
          select: {
            id: true,
            name: true,
            document: true,
            email: true,
            street: true,
            number: true,
            district: true,
            city: true,
            state: true,
            zipCode: true,
          },
        },
        financialEntries: { orderBy: [{ type: 'asc' }, { installment: 'asc' }] },
      },
    });

    if (!sale) {
      throw new NotFoundException('Venda nao encontrada.');
    }

    return sale;
  }

  // Cancela uma venda concluida: devolve os itens ao estoque, cancela o que
  // ainda estava a receber e registra o estorno do que ja tinha sido pago.
  async cancel(id: string, dto: CancelSaleDto, userId: string) {
    const current = await this.prisma.sale.findUnique({ where: { id }, select: { status: true } });
    if (!current) throw new NotFoundException('Venda nao encontrada.');
    if (current.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException('Apenas vendas concluidas podem ser canceladas.');
    }

    // Primeiro a nota: se a SEFAZ recusar o cancelamento (prazo vencido,
    // justificativa curta), a venda nao e cancelada.
    await this.fiscalService.cancelAuthorized(id, dto.reason);

    await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: { items: true, financialEntries: true },
      });

      if (!sale) {
        throw new NotFoundException('Venda nao encontrada.');
      }

      // UPDATE condicional: dois cancelamentos simultaneos nao conseguem
      // devolver o estoque duas vezes.
      const updated = await tx.sale.updateMany({
        where: { id, status: SaleStatus.COMPLETED },
        data: {
          status: SaleStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: dto.reason,
        },
      });

      if (updated.count === 0) {
        throw new BadRequestException('Apenas vendas concluidas podem ser canceladas.');
      }

      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: item.quantity } },
        });
      }

      await tx.stockMovement.createMany({
        data: sale.items.map((item) => ({
          type: MovementType.ENTRADA,
          quantity: item.quantity,
          reason: `Cancelamento da venda #${sale.number}`,
          productId: item.productId,
          userId,
        })),
      });

      const receivables = sale.financialEntries.filter(
        (entry) => entry.type === FinancialEntryType.RECEIVABLE,
      );

      await tx.financialEntry.updateMany({
        where: {
          saleId: id,
          type: FinancialEntryType.RECEIVABLE,
          status: FinancialEntryStatus.OPEN,
        },
        data: { status: FinancialEntryStatus.CANCELLED },
      });

      const refundCents = receivables
        .filter((entry) => entry.status === FinancialEntryStatus.PAID)
        .reduce((sum, entry) => sum + toCents(entry.amount), 0);

      if (refundCents > 0) {
        await tx.financialEntry.create({
          data: {
            type: FinancialEntryType.PAYABLE,
            status: FinancialEntryStatus.PAID,
            description: `Estorno da venda #${sale.number}`,
            category: 'Estornos',
            amount: fromCents(refundCents),
            dueDate: toDueDate(),
            paidAt: new Date(),
            paymentMethod: sale.paymentMethod,
            saleId: sale.id,
            customerId: sale.customerId,
            notes: dto.reason,
            userId,
          },
        });
      }

      // Nota que ainda nao tinha sido autorizada nao sera mais emitida.
      await tx.fiscalDocument.updateMany({
        where: {
          saleId: id,
          status: { in: [FiscalStatus.QUEUED, FiscalStatus.FAILED, FiscalStatus.REJECTED] },
        },
        data: {
          status: FiscalStatus.NOT_REQUESTED,
          errorMessage: 'Venda cancelada antes da autorização.',
        },
      });
    });

    return this.findOneOrThrow(id);
  }

  // Reenvia a nota de uma venda cuja emissao falhou, foi rejeitada (depois
  // de corrigir o cadastro) ou nunca saiu da fila.
  async retryFiscalEmission(id: string) {
    const sale = await this.findOneOrThrow(id);

    if (sale.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException('Apenas vendas concluidas podem emitir NF-e.');
    }

    const retryable: FiscalStatus[] = [
      FiscalStatus.FAILED,
      FiscalStatus.QUEUED,
      FiscalStatus.REJECTED,
    ];
    if (!sale.fiscalDocument || !retryable.includes(sale.fiscalDocument.status)) {
      throw new BadRequestException(
        'A nota desta venda nao esta pendente, com falha ou rejeitada.',
      );
    }

    await this.prisma.fiscalDocument.update({
      where: { saleId: id },
      data: { status: FiscalStatus.QUEUED, errorMessage: null },
    });
    await this.fiscalService.enqueueEmission(id);

    return this.findOneOrThrow(id);
  }

  private async enqueueFiscalSafely(saleId: string) {
    try {
      await this.fiscalService.enqueueEmission(saleId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Nao foi possivel enfileirar a NF-e da venda ${saleId}: ${message}`);
    }
  }
}

// NF-e (modelo 55) exige destinatario identificado e com endereco.
function assertNfeRecipient(customer: Customer) {
  const missing: string[] = [];
  if (!customer.document || !isValidCpfOrCnpj(customer.document)) missing.push('CPF/CNPJ válido');
  if (!customer.street) missing.push('logradouro');
  if (!customer.number) missing.push('número');
  if (!customer.district) missing.push('bairro');
  if (!customer.cityCode || !/^\d{7}$/.test(customer.cityCode))
    missing.push('código IBGE do município');
  if (!customer.state) missing.push('UF');
  if (!customer.zipCode) missing.push('CEP');
  if (missing.length > 0) {
    throw new BadRequestException(
      `Para emitir NF-e, complete o cadastro do cliente: ${missing.join(', ')}. Ou emita NFC-e com CPF na nota.`,
    );
  }
}
