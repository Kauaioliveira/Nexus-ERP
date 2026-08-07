import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StockMovementsService } from './stock-movements.service';

describe('StockMovementsService', () => {
  let service: StockMovementsService;
  let tx: {
    product: { findUnique: jest.Mock; update: jest.Mock };
    stockMovement: { create: jest.Mock };
  };
  let prisma: {
    $transaction: jest.Mock;
    stockMovement: { findMany: jest.Mock; count: jest.Mock };
  };

  beforeEach(async () => {
    tx = {
      product: { findUnique: jest.fn(), update: jest.fn() },
      stockMovement: { create: jest.fn() },
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

  const activeProduct = (currentStock: number) => ({
    id: 'prod-1',
    active: true,
    currentStock,
  });

  describe('create', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      tx.product.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { productId: 'missing', type: MovementType.ENTRADA, quantity: 5 },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when the product is inactive', async () => {
      tx.product.findUnique.mockResolvedValue({ ...activeProduct(10), active: false });

      await expect(
        service.create({ productId: 'prod-1', type: MovementType.ENTRADA, quantity: 5 }, 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('increases stock on ENTRADA and persists the new balance', async () => {
      tx.product.findUnique.mockResolvedValue(activeProduct(10));
      tx.stockMovement.create.mockResolvedValue({ id: 'mv-1' });

      await service.create(
        { productId: 'prod-1', type: MovementType.ENTRADA, quantity: 5 },
        'user-1',
      );

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { currentStock: 15 },
      });
    });

    it('rejects ENTRADA with a non-positive quantity', async () => {
      tx.product.findUnique.mockResolvedValue(activeProduct(10));

      await expect(
        service.create({ productId: 'prod-1', type: MovementType.ENTRADA, quantity: -5 }, 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('decreases stock on SAIDA when there is enough balance', async () => {
      tx.product.findUnique.mockResolvedValue(activeProduct(10));
      tx.stockMovement.create.mockResolvedValue({ id: 'mv-1' });

      await service.create({ productId: 'prod-1', type: MovementType.SAIDA, quantity: 4 }, 'user-1');

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { currentStock: 6 },
      });
    });

    it('rejects SAIDA that would leave the stock negative', async () => {
      tx.product.findUnique.mockResolvedValue(activeProduct(3));

      await expect(
        service.create({ productId: 'prod-1', type: MovementType.SAIDA, quantity: 10 }, 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.product.update).not.toHaveBeenCalled();
    });

    it('applies a positive AJUSTE delta directly', async () => {
      tx.product.findUnique.mockResolvedValue(activeProduct(10));
      tx.stockMovement.create.mockResolvedValue({ id: 'mv-1' });

      await service.create({ productId: 'prod-1', type: MovementType.AJUSTE, quantity: 3 }, 'user-1');

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { currentStock: 13 },
      });
    });

    it('applies a negative AJUSTE delta and rejects if it goes below zero', async () => {
      tx.product.findUnique.mockResolvedValue(activeProduct(2));

      await expect(
        service.create({ productId: 'prod-1', type: MovementType.AJUSTE, quantity: -5 }, 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
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
