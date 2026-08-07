import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({ data: dto });
    } catch (error) {
      this.rethrowIfUniqueConstraint(error);
    }
  }

  async findAll(query: ListProductsQueryDto) {
    const { page, pageSize, search, categoryId, active } = query;

    const where: Prisma.ProductWhereInput = {
      ...(categoryId && { categoryId }),
      ...(active !== undefined && { active }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
        include: { category: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOneOrThrow(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, supplier: true },
    });

    if (!product) {
      throw new NotFoundException('Produto nao encontrado.');
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOneOrThrow(id);

    try {
      return await this.prisma.product.update({ where: { id }, data: dto });
    } catch (error) {
      this.rethrowIfUniqueConstraint(error);
    }
  }

  // Soft delete: produtos ja referenciados por movimentacoes/vendas nao
  // podem ser removidos fisicamente sem perder o historico.
  async deactivate(id: string) {
    await this.findOneOrThrow(id);
    return this.prisma.product.update({ where: { id }, data: { active: false } });
  }

  private rethrowIfUniqueConstraint(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Ja existe um produto com este SKU ou codigo de barras.');
    }
    throw error as Error;
  }
}
