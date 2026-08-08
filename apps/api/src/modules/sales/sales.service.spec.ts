import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { FiscalStatus, MovementType, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FiscalService } from '../fiscal/fiscal.service';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  let service: SalesService;
  let tx: {
    product: { findUnique: jest.Mock; update: jest.Mock };
    sale: { create: jest.Mock };
    stockMovement: { create: jest.Mock };
    fiscalDocument: { create: jest.Mock };
  };
  let prisma: { $transaction: jest.Mock; sale: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock } };
  let fiscalService: { enqueueEmission: jest.Mock };

  const product = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'prod-1',
    name: 'Produto A',
    active: true,
    currentStock: 10,
    salePrice: 25,
    ...overrides,
  });

  beforeEach(async () => {
    tx = {
      product: { findUnique: jest.fn(), update: jest.fn() },
      sale: { create: jest.fn() },
      stockMovement: { create: jest.fn().mockResolvedValue({}) },
      fiscalDocument: { create: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
      sale: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };

    fiscalService = { enqueueEmission: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PrismaService, useValue: prisma },
        { provide: FiscalService, useValue: fiscalService },
        { provide: ConfigService, useValue: { get: () => 'sandbox' } },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  describe('create', () => {
    it('creates the sale, decrements stock, records a SAIDA movement and enqueues fiscal emission', async () => {
      tx.product.findUnique.mockResolvedValue(product());
      tx.sale.create.mockResolvedValue({ id: 'sale-1' });
      prisma.sale.findUnique.mockResolvedValue({ id: 'sale-1', items: [], fiscalDocument: null });

      await service.create({ items: [{ productId: 'prod-1', quantity: 3 }] }, 'user-1');

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { currentStock: 7 },
      });
      expect(tx.sale.create).toHaveBeenCalledWith({
        data: {
          status: SaleStatus.COMPLETED,
          total: 75,
          userId: 'user-1',
          items: { create: [{ productId: 'prod-1', quantity: 3, unitPrice: 25 }] },
        },
      });
      expect(tx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: MovementType.SAIDA,
          quantity: 3,
          productId: 'prod-1',
          userId: 'user-1',
        }),
      });
      expect(tx.fiscalDocument.create).toHaveBeenCalledWith({
        data: { saleId: 'sale-1', provider: 'sandbox', status: FiscalStatus.QUEUED },
      });
      expect(fiscalService.enqueueEmission).toHaveBeenCalledWith('sale-1');
    });

    it('throws NotFoundException when the product does not exist', async () => {
      tx.product.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ items: [{ productId: 'missing', quantity: 1 }] }, 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(fiscalService.enqueueEmission).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when stock is insufficient', async () => {
      tx.product.findUnique.mockResolvedValue(product({ currentStock: 2 }));

      await expect(
        service.create({ items: [{ productId: 'prod-1', quantity: 5 }] }, 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.sale.create).not.toHaveBeenCalled();
    });

    it('accumulates quantity correctly when the same product appears twice', async () => {
      // Primeira leitura: 10 em estoque. Depois do primeiro item (6
      // unidades), a segunda leitura deve refletir 4 em estoque e permitir
      // apenas ate 4 unidades no segundo item.
      tx.product.findUnique
        .mockResolvedValueOnce(product({ currentStock: 10 }))
        .mockResolvedValueOnce(product({ currentStock: 4 }));
      tx.sale.create.mockResolvedValue({ id: 'sale-1' });
      prisma.sale.findUnique.mockResolvedValue({ id: 'sale-1', items: [], fiscalDocument: null });

      await service.create(
        {
          items: [
            { productId: 'prod-1', quantity: 6 },
            { productId: 'prod-1', quantity: 4 },
          ],
        },
        'user-1',
      );

      expect(tx.product.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'prod-1' },
        data: { currentStock: 4 },
      });
      expect(tx.product.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'prod-1' },
        data: { currentStock: 0 },
      });
    });
  });

  describe('findOneOrThrow', () => {
    it('throws NotFoundException when the sale does not exist', async () => {
      prisma.sale.findUnique.mockResolvedValue(null);

      await expect(service.findOneOrThrow('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('filters by status', async () => {
      prisma.sale.findMany.mockResolvedValue([]);
      prisma.sale.count.mockResolvedValue(0);

      await service.findAll({ page: 1, pageSize: 20, status: SaleStatus.COMPLETED });

      const [findManyArgs] = prisma.sale.findMany.mock.calls[0];
      expect(findManyArgs.where).toEqual({ status: SaleStatus.COMPLETED });
    });
  });
});
