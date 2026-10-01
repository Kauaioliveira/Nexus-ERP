import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MovementType } from '@prisma/client';
import { createFakeProductTable } from '../../common/testing/fake-product-table';
import { PrismaService } from '../../prisma/prisma.service';
import { StockMovementsService } from './stock-movements.service';

describe('StockMovementsService', () => {
  let service: StockMovementsService;
  let products: ReturnType<typeof createFakeProductTable>;
  let tx: { product: typeof products; stockMovement: { create: jest.Mock } };
  let prisma: {
    $transaction: jest.Mock;
    stockMovement: { findMany: jest.Mock; count: jest.Mock };
  };

  beforeEach(async () => {
    products = createFakeProductTable([
      { id: 'prod-1', name: 'Produto A', active: true, currentStock: 10 },
      { id: 'prod-off', name: 'Inativo', active: false, currentStock: 10 },
    ]);
    tx = {
      product: products,
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'mv' }) },
    };

    prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
      stockMovement: { findMany: jest.fn(), count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StockMovementsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<StockMovementsService>(StockMovementsService);
  });

  const stockOf = (id: string) => products.rows.get(id)?.currentStock;

  describe('create', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      await expect(
        service.create({ productId: 'missing', type: MovementType.ENTRADA, quantity: 5 }, 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the product is inactive', async () => {
      await expect(
        service.create(
          { productId: 'prod-off', type: MovementType.ENTRADA, quantity: 5 },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(stockOf('prod-off')).toBe(10);
    });

    it('increases stock on ENTRADA and records the movement', async () => {
      await service.create(
        { productId: 'prod-1', type: MovementType.ENTRADA, quantity: 5 },
        'user-1',
      );

      expect(stockOf('prod-1')).toBe(15);
      expect(tx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: MovementType.ENTRADA,
          quantity: 5,
          userId: 'user-1',
        }),
      });
    });

    it('rejects ENTRADA with a non-positive quantity', async () => {
      await expect(
        service.create({ productId: 'prod-1', type: MovementType.ENTRADA, quantity: -5 }, 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stockOf('prod-1')).toBe(10);
    });

    it('decreases stock on SAIDA when there is enough balance', async () => {
      await service.create(
        { productId: 'prod-1', type: MovementType.SAIDA, quantity: 4 },
        'user-1',
      );

      expect(stockOf('prod-1')).toBe(6);
    });

    it('rejects SAIDA that would leave the stock negative and records nothing', async () => {
      await expect(
        service.create({ productId: 'prod-1', type: MovementType.SAIDA, quantity: 11 }, 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stockOf('prod-1')).toBe(10);
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('never oversells when two SAIDAs compete for the last units', async () => {
      const results = await Promise.allSettled([
        service.create({ productId: 'prod-1', type: MovementType.SAIDA, quantity: 7 }, 'user-1'),
        service.create({ productId: 'prod-1', type: MovementType.SAIDA, quantity: 7 }, 'user-2'),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(stockOf('prod-1')).toBe(3);
    });

    it('applies a positive AJUSTE delta directly', async () => {
      await service.create(
        { productId: 'prod-1', type: MovementType.AJUSTE, quantity: 3 },
        'user-1',
      );

      expect(stockOf('prod-1')).toBe(13);
    });

    it('applies a negative AJUSTE delta and rejects if it goes below zero', async () => {
      await expect(
        service.create({ productId: 'prod-1', type: MovementType.AJUSTE, quantity: -11 }, 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);

      await service.create(
        { productId: 'prod-1', type: MovementType.AJUSTE, quantity: -4 },
        'user-1',
      );
      expect(stockOf('prod-1')).toBe(6);
    });
  });

  describe('findAll', () => {
    it('filters by productId and type with pagination', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        pageSize: 20,
        productId: 'prod-1',
        type: MovementType.ENTRADA,
      });

      const [findManyArgs] = prisma.stockMovement.findMany.mock.calls[0];
      expect(findManyArgs.where).toEqual({ productId: 'prod-1', type: MovementType.ENTRADA });
    });
  });
});
