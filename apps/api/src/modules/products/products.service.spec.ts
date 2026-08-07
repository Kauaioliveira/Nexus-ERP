import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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

      const result = await service.create({
        sku: 'SKU-1',
        name: 'Produto 1',
        costPrice: 10,
        salePrice: 20,
      } as any);

      expect(result).toEqual({ id: '1', sku: 'SKU-1' });
    });

    it('translates a unique constraint violation into ConflictException', async () => {
      prisma.product.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        service.create({ sku: 'DUP', name: 'Produto', costPrice: 1, salePrice: 2 } as any),
      ).rejects.toBeInstanceOf(ConflictException);
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
});
