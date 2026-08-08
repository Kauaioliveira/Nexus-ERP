import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.20.0',
  });
}

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: {
    product: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      product: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('create', () => {
    it('creates a product', async () => {
      prisma.product.create.mockResolvedValue({ id: '1', sku: 'SKU-1' });

      const dto: CreateProductDto = {
        sku: 'SKU-1',
        name: 'Produto 1',
        costPrice: 10,
        salePrice: 20,
      };
      const result = await service.create(dto);

      expect(result).toEqual({ id: '1', sku: 'SKU-1' });
    });

    it('translates a unique constraint violation into ConflictException', async () => {
      prisma.product.create.mockRejectedValue(uniqueConstraintError());

      const dto: CreateProductDto = { sku: 'DUP', name: 'Produto', costPrice: 1, salePrice: 2 };
      await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findOneOrThrow', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOneOrThrow('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the product when found', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: '1', sku: 'SKU-1' });

      const result = await service.findOneOrThrow('1');

      expect(result).toEqual({ id: '1', sku: 'SKU-1' });
    });
  });

  describe('update', () => {
    it('propagates NotFoundException when updating a missing product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.update('missing-id', { name: 'Novo nome' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('sets active to false without deleting the record', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: '1', active: true });
      prisma.product.update.mockResolvedValue({ id: '1', active: false });

      const result = await service.deactivate('1');

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { active: false },
      });
      expect(result.active).toBe(false);
    });
  });

  describe('findAll', () => {
    it('applies search, category and active filters together', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({
        page: 2,
        pageSize: 10,
        search: 'parafuso',
        categoryId: 'cat-1',
        active: true,
      });

      const [findManyArgs] = prisma.product.findMany.mock.calls[0];
      expect(findManyArgs.where.categoryId).toBe('cat-1');
      expect(findManyArgs.where.active).toBe(true);
      expect(findManyArgs.where.OR).toBeDefined();
      expect(findManyArgs.skip).toBe(10);
      expect(findManyArgs.take).toBe(10);
    });
  });

  describe('findLowStock', () => {
    it('returns only active products at or below minStock, most critical first', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: '1', name: 'A', currentStock: 5, minStock: 10 }, // -5
        { id: '2', name: 'B', currentStock: 20, minStock: 5 }, // +15, acima do minimo
        { id: '3', name: 'C', currentStock: 0, minStock: 3 }, // -3
        { id: '4', name: 'D', currentStock: -2, minStock: 10 }, // -12, mais critico
      ]);

      const result = await service.findLowStock();

      expect(result.map((p) => p.id)).toEqual(['4', '1', '3']);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { active: true } }),
      );
    });
  });
});
