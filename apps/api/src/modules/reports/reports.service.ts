import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BUSINESS_UTC_OFFSET_HOURS,
  addDays,
  localDayEnd,
  localDayStart,
  toLocalDay,
} from '../../common/utils/dates';
import { fromCents, toCents } from '../../common/utils/money';
import { OverviewQueryDto } from './dto/overview-query.dto';

type Numeric = Prisma.Decimal | number | bigint | null;

interface SalesByDayRow {
  day: string;
  total: Numeric;
  count: Numeric;
}

interface TopProductRow {
  productId: string;
  name: string;
  sku: string;
  quantity: Numeric;
  revenue: Numeric;
}

interface PeriodTotalsRow {
  count: Numeric;
  revenue: Numeric;
  discount: Numeric;
  cost: Numeric;
}

interface StockRow {
  activeProducts: Numeric;
  lowStock: Numeric;
  costValue: Numeric;
  saleValue: Numeric;
}

const money = (value: Numeric) => fromCents(toCents(Number(value ?? 0)));
const int = (value: Numeric) => Number(value ?? 0);
// Colunas guardam UTC sem fuso; parametros ISO sao convertidos para o
// mesmo formato para a comparacao nao depender do fuso da sessao do banco.
const utc = (date: Date) => Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Numeros do painel: vendas do dia e do periodo, lucro bruto, produtos
  // mais vendidos, formas de pagamento e valor do estoque. Tudo agregado no
  // banco (antes o painel somava so as ultimas 50 vendas no navegador).
  async overview(query: OverviewQueryDto, includeCosts: boolean) {
    const to = query.to ?? toLocalDay();
    const from = query.from ?? toLocalDay(addDays(localDayStart(to), -29));

    if (from > to) {
      throw new BadRequestException('A data inicial deve ser anterior a data final.');
    }

    const start = localDayStart(from);
    const end = localDayEnd(to);
    const today = toLocalDay();
    const offset = `${-BUSINESS_UTC_OFFSET_HOURS} hours`;
    const completed = SaleStatus.COMPLETED;

    const [todayTotals, periodTotals, salesByDay, topProducts, byPayment, stock] =
      await Promise.all([
        this.prisma.sale.aggregate({
          where: {
            status: completed,
            createdAt: { gte: localDayStart(today), lte: localDayEnd(today) },
          },
          _count: true,
          _sum: { total: true },
        }),
        this.prisma.$queryRaw<PeriodTotalsRow[]>`
          SELECT COUNT(*) AS count,
                 COALESCE(SUM(s."total"), 0) AS revenue,
                 COALESCE(SUM(s."discount"), 0) AS discount,
                 COALESCE(SUM(c.cost), 0) AS cost
            FROM "sales" s
            LEFT JOIN (
              SELECT "saleId", SUM("quantity" * "unitCost") AS cost
                FROM "sale_items" GROUP BY "saleId"
            ) c ON c."saleId" = s."id"
           WHERE s."status" = 'COMPLETED'
             AND s."createdAt" BETWEEN ${utc(start)} AND ${utc(end)}`,
        this.prisma.$queryRaw<SalesByDayRow[]>`
          SELECT to_char("createdAt" - ${offset}::interval, 'YYYY-MM-DD') AS day,
                 SUM("total") AS total,
                 COUNT(*) AS count
            FROM "sales"
           WHERE "status" = 'COMPLETED'
             AND "createdAt" BETWEEN ${utc(start)} AND ${utc(end)}
           GROUP BY 1
           ORDER BY 1`,
        this.prisma.$queryRaw<TopProductRow[]>`
          SELECT p."id" AS "productId", p."name", p."sku",
                 SUM(i."quantity") AS quantity,
                 SUM(i."quantity" * i."unitPrice") AS revenue
            FROM "sale_items" i
            JOIN "sales" s ON s."id" = i."saleId"
            JOIN "products" p ON p."id" = i."productId"
           WHERE s."status" = 'COMPLETED'
             AND s."createdAt" BETWEEN ${utc(start)} AND ${utc(end)}
           GROUP BY p."id", p."name", p."sku"
           ORDER BY revenue DESC
           LIMIT 5`,
        this.prisma.sale.groupBy({
          by: ['paymentMethod'],
          where: { status: completed, createdAt: { gte: start, lte: end } },
          _count: true,
          _sum: { total: true },
          orderBy: { _sum: { total: 'desc' } },
        }),
        this.prisma.$queryRaw<StockRow[]>`
          SELECT COUNT(*) AS "activeProducts",
                 COUNT(*) FILTER (WHERE "currentStock" <= "minStock") AS "lowStock",
                 COALESCE(SUM(GREATEST("currentStock", 0) * "costPrice"), 0) AS "costValue",
                 COALESCE(SUM(GREATEST("currentStock", 0) * "salePrice"), 0) AS "saleValue"
            FROM "products"
           WHERE "active" = true`,
      ]);

    const totals = periodTotals[0];
    const salesCount = int(totals?.count);
    const revenueCents = toCents(Number(totals?.revenue ?? 0));
    const costCents = toCents(Number(totals?.cost ?? 0));
    const stockRow = stock[0];

    return {
      period: { from, to },
      today: { count: todayTotals._count, total: money(todayTotals._sum.total) },
      sales: {
        count: salesCount,
        revenue: fromCents(revenueCents),
        discount: money(totals?.discount ?? 0),
        averageTicket: salesCount > 0 ? fromCents(Math.round(revenueCents / salesCount)) : 0,
        ...(includeCosts && {
          cost: fromCents(costCents),
          grossProfit: fromCents(revenueCents - costCents),
          grossMargin:
            revenueCents > 0
              ? Math.round(((revenueCents - costCents) / revenueCents) * 1000) / 10
              : 0,
        }),
      },
      salesByDay: salesByDay.map((row) => ({
        date: row.day,
        total: money(row.total),
        count: int(row.count),
      })),
      topProducts: topProducts.map((row) => ({
        productId: row.productId,
        name: row.name,
        sku: row.sku,
        quantity: int(row.quantity),
        revenue: money(row.revenue),
      })),
      paymentMethods: byPayment.map((row) => ({
        paymentMethod: row.paymentMethod,
        count: row._count,
        total: money(row._sum.total),
      })),
      stock: {
        activeProducts: int(stockRow?.activeProducts),
        lowStock: int(stockRow?.lowStock),
        saleValue: money(stockRow?.saleValue ?? 0),
        ...(includeCosts && { costValue: money(stockRow?.costValue ?? 0) }),
      },
    };
  }
}
