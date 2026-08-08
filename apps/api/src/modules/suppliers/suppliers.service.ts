import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { ListSuppliersQueryDto } from './dto/list-suppliers-query.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSupplierDto) {
    try {
      return await this.prisma.supplier.create({ data: dto });
    } catch (error) {
      this.rethrowIfUniqueConstraint(error);
    }
  }

  async findAll(query: ListSuppliersQueryDto) {
    const { page, pageSize, search, active } = query;

    const where: Prisma.SupplierWhereInput = {
      ...(active !== undefined && { active }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { document: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOneOrThrow(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });

    if (!supplier) {
      throw new NotFoundException('Fornecedor nao encontrado.');
    }

    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOneOrThrow(id);

    try {
      return await this.prisma.supplier.update({ where: { id }, data: dto });
    } catch (error) {
      this.rethrowIfUniqueConstraint(error);
    }
  }

  // Soft delete: produtos ja vinculados a este fornecedor preservam a
  // referencia e o historico.
  async deactivate(id: string) {
    await this.findOneOrThrow(id);
    return this.prisma.supplier.update({ where: { id }, data: { active: false } });
  }

  private rethrowIfUniqueConstraint(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Ja existe um fornecedor com este documento (CNPJ/CPF).');
    }
    throw error as Error;
  }
}
