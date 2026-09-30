import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialEntryStatus, FinancialEntryType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BUSINESS_UTC_OFFSET_HOURS,
  addDays,
  localDayEnd,
  localDayStart,
  startOfLocalMonth,
  toDueDate,
  toLocalDay,
} from '../../common/utils/dates';
import { fromCents, toCents } from '../../common/utils/money';
import { buildInstallmentEntries } from './financial-entries.builder';
import { CreateFinancialEntryDto } from './dto/create-financial-entry.dto';
import { FinancialSummaryQueryDto } from './dto/financial-summary-query.dto';
import { ListFinancialEntriesQueryDto } from './dto/list-financial-entries-query.dto';
import { PayFinancialEntryDto } from './dto/pay-financial-entry.dto';
import { UpdateFinancialEntryDto } from './dto/update-financial-entry.dto';

const ENTRY_INCLUDE = {
  customer: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  sale: { select: { id: true, number: true } },
  purchaseOrder: { select: { id: true, number: true } },
} satisfies Prisma.FinancialEntryInclude;

interface DailyCashRow {
  day: string;
  received: Prisma.Decimal | null;
  paid: Prisma.Decimal | null;
}

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFinancialEntryDto, userId: string) {
    if (dto.customerId && dto.type !== FinancialEntryType.RECEIVABLE) {
      throw new BadRequestException('Cliente so pode ser vinculado a uma conta a receber.');
    }
    if (dto.supplierId && dto.type !== FinancialEntryType.PAYABLE) {
      throw new BadRequestException('Fornecedor so pode ser vinculado a uma conta a pagar.');
    }

    const entries = buildInstallmentEntries({
      type: dto.type,
      description: dto.description,
      totalCents: toCents(dto.amount),
      installments: dto.installments ?? 1,
      firstDueDate: toDueDate(dto.dueDate),
      category: dto.category,
      notes: dto.notes,
      customerId: dto.customerId,
      supplierId: dto.supplierId,
      paymentMethod: dto.paymentMethod,
      paidAt: dto.paid ? new Date() : undefined,
      userId,
    });

    // createManyAndReturn nao existe no Prisma 5: cria um a um dentro da
    // mesma transacao para devolver os registros criados.
    return this.prisma.$transaction((tx) =>
      Promise.all(
        entries.map((data) => tx.financialEntry.create({ data, include: ENTRY_INCLUDE })),
      ),
    );
  }

  async findAll(query: ListFinancialEntriesQueryDto) {
    const { page, pageSize, type, status, overdue, dueFrom, dueTo, search } = query;
    const { customerId, supplierId } = query;

    const where: Prisma.FinancialEntryWhereInput = {
      ...(type && { type }),
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(supplierId && { supplierId }),
      ...(search && { description: { contains: search, mode: 'insensitive' } }),
      ...((dueFrom || dueTo) && {
        dueDate: {
          ...(dueFrom && { gte: localDayStart(dueFrom) }),
          ...(dueTo && { lte: localDayEnd(dueTo) }),
        },
      }),
      ...(overdue && {
        status: FinancialEntryStatus.OPEN,
        dueDate: { lt: localDayStart(toLocalDay()) },
      }),
    };

    const [items, total, sum] = await Promise.all([
      this.prisma.financialEntry.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        include: ENTRY_INCLUDE,
      }),
      this.prisma.financialEntry.count({ where }),
      this.prisma.financialEntry.aggregate({ where, _sum: { amount: true } }),
    ]);

    return { items, total, page, pageSize, totalAmount: sum._sum.amount ?? 0 };
  }

  async findOneOrThrow(id: string) {
    const entry = await this.prisma.financialEntry.findUnique({
      where: { id },
      include: ENTRY_INCLUDE,
    });

    if (!entry) {
      throw new NotFoundException('Lancamento nao encontrado.');
    }

    return entry;
  }

  async update(id: string, dto: UpdateFinancialEntryDto) {
    await this.findOpenOrThrow(id, 'editado');

    return this.prisma.financialEntry.update({
      where: { id },
      data: {
        description: dto.description,
        amount: dto.amount,
        dueDate: dto.dueDate ? toDueDate(dto.dueDate) : undefined,
        category: dto.category,
        notes: dto.notes,
      },
      include: ENTRY_INCLUDE,
    });
  }

  // Baixa: registra que a conta foi recebida/paga.
  async pay(id: string, dto: PayFinancialEntryDto) {
    const entry = await this.findOpenOrThrow(id, 'quitado');

    return this.prisma.financialEntry.update({
      where: { id },
      data: {
        status: FinancialEntryStatus.PAID,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        paymentMethod: dto.paymentMethod ?? entry.paymentMethod,
      },
      include: ENTRY_INCLUDE,
    });
  }

  // Estorna uma baixa feita por engano: volta a ficar em aberto.
  async reopen(id: string) {
    const entry = await this.findOneOrThrow(id);

    if (entry.status !== FinancialEntryStatus.PAID) {
      throw new BadRequestException('Apenas lancamentos quitados podem ser reabertos.');
    }

    return this.prisma.financialEntry.update({
      where: { id },
      data: { status: FinancialEntryStatus.OPEN, paidAt: null },
      include: ENTRY_INCLUDE,
    });
  }

  async cancel(id: string) {
    await this.findOpenOrThrow(id, 'cancelado');

    return this.prisma.financialEntry.update({
      where: { id },
      data: { status: FinancialEntryStatus.CANCELLED },
      include: ENTRY_INCLUDE,
    });
  }

  // Fluxo de caixa do periodo (pelo que efetivamente entrou/saiu) e
  // posicao atual das contas em aberto.
  async summary(query: FinancialSummaryQueryDto) {
    const from = query.from ?? startOfLocalMonth();
    const to = query.to ?? toLocalDay();

    if (from > to) {
      throw new BadRequestException('A data inicial deve ser anterior a data final.');
    }

    const periodStart = localDayStart(from);
    const periodEnd = localDayEnd(to);
    const todayStart = localDayStart(toLocalDay());
    const nextWeekEnd = localDayEnd(toLocalDay(addDays(new Date(), 7)));

    const sumWhere = (where: Prisma.FinancialEntryWhereInput) =>
      this.prisma.financialEntry.aggregate({ where, _sum: { amount: true }, _count: true });

    const paidInPeriod = (type: FinancialEntryType) =>
      sumWhere({
        type,
        status: FinancialEntryStatus.PAID,
        paidAt: { gte: periodStart, lte: periodEnd },
      });
    const open = (type: FinancialEntryType, dueDate?: Prisma.DateTimeFilter) =>
      sumWhere({ type, status: FinancialEntryStatus.OPEN, ...(dueDate && { dueDate }) });

    const offset = `${-BUSINESS_UTC_OFFSET_HOURS} hours`;

    const [
      received,
      paid,
      openReceivable,
      openPayable,
      overdueReceivable,
      overduePayable,
      payableNext7Days,
      receivableNext7Days,
      daily,
    ] = await Promise.all([
      paidInPeriod(FinancialEntryType.RECEIVABLE),
      paidInPeriod(FinancialEntryType.PAYABLE),
      open(FinancialEntryType.RECEIVABLE),
      open(FinancialEntryType.PAYABLE),
      open(FinancialEntryType.RECEIVABLE, { lt: todayStart }),
      open(FinancialEntryType.PAYABLE, { lt: todayStart }),
      open(FinancialEntryType.PAYABLE, { gte: todayStart, lte: nextWeekEnd }),
      open(FinancialEntryType.RECEIVABLE, { gte: todayStart, lte: nextWeekEnd }),
      // As colunas guardam UTC sem fuso: o dia local e "paidAt - 3h".
      this.prisma.$queryRaw<DailyCashRow[]>`
        SELECT to_char("paidAt" - ${offset}::interval, 'YYYY-MM-DD') AS day,
               SUM(CASE WHEN "type" = 'RECEIVABLE' THEN "amount" END) AS received,
               SUM(CASE WHEN "type" = 'PAYABLE' THEN "amount" END) AS paid
          FROM "financial_entries"
         WHERE "status" = 'PAID'
           AND "paidAt" BETWEEN (${periodStart.toISOString()}::timestamptz AT TIME ZONE 'UTC')
                            AND (${periodEnd.toISOString()}::timestamptz AT TIME ZONE 'UTC')
         GROUP BY 1
         ORDER BY 1`,
    ]);

    const money = (value: Prisma.Decimal | null | undefined) => fromCents(toCents(value ?? 0));
    const bucket = (result: { _sum: { amount: Prisma.Decimal | null }; _count: number }) => ({
      total: money(result._sum.amount),
      count: result._count,
    });

    return {
      period: { from, to },
      cashFlow: {
        received: money(received._sum.amount),
        paid: money(paid._sum.amount),
        balance: fromCents(toCents(received._sum.amount ?? 0) - toCents(paid._sum.amount ?? 0)),
        daily: daily.map((row) => ({
          date: row.day,
          received: money(row.received),
          paid: money(row.paid),
        })),
      },
      receivables: {
        open: bucket(openReceivable),
        overdue: bucket(overdueReceivable),
        next7Days: bucket(receivableNext7Days),
      },
      payables: {
        open: bucket(openPayable),
        overdue: bucket(overduePayable),
        next7Days: bucket(payableNext7Days),
      },
    };
  }

  private async findOpenOrThrow(id: string, action: string) {
    const entry = await this.findOneOrThrow(id);

    if (entry.status !== FinancialEntryStatus.OPEN) {
      throw new BadRequestException(`Apenas lancamentos em aberto podem ser ${action}s.`);
    }

    return entry;
  }
}
