import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialEntryStatus, FinancialEntryType, Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerDto) {
    try {
      return await this.prisma.customer.create({ data: dto });
    } catch (error) {
      this.rethrowIfUniqueConstraint(error);
    }
  }

  async findAll(query: ListCustomersQueryDto) {
    const { page, pageSize, search, active } = query;

    const where: Prisma.CustomerWhereInput = {
      ...(active !== undefined && { active }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { document: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  // Ficha do cliente: dados cadastrais + historico de compras e quanto
  // ele ainda deve (contas a receber em aberto).
  async findOneOrThrow(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });

    if (!customer) {
      throw new NotFoundException('Cliente nao encontrado.');
    }

    const [salesStats, openBalance, recentSales] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { customerId: id, status: SaleStatus.COMPLETED },
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.financialEntry.aggregate({
        where: {
          customerId: id,
          type: FinancialEntryType.RECEIVABLE,
          status: FinancialEntryStatus.OPEN,
        },
        _sum: { amount: true },
      }),
      this.prisma.sale.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          paymentMethod: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      ...customer,
      stats: {
        salesCount: salesStats._count,
        salesTotal: salesStats._sum.total ?? 0,
        openBalance: openBalance._sum.amount ?? 0,
      },
      recentSales,
    };
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.ensureExists(id);

    try {
      return await this.prisma.customer.update({ where: { id }, data: dto });
    } catch (error) {
      this.rethrowIfUniqueConstraint(error);
    }
  }

  // Soft delete: vendas e lancamentos do cliente continuam no historico.
  async deactivate(id: string) {
    await this.ensureExists(id);
    return this.prisma.customer.update({ where: { id }, data: { active: false } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.customer.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException('Cliente nao encontrado.');
    }
  }

  private rethrowIfUniqueConstraint(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Ja existe um cliente com este documento (CPF/CNPJ).');
    }
    throw error as Error;
  }
}
