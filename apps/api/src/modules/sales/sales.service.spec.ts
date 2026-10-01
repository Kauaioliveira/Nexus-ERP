import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  FinancialEntryStatus,
  FinancialEntryType,
  FiscalStatus,
  MovementType,
  PaymentMethod,
  SaleStatus,
} from '@prisma/client';
import { createFakeProductTable } from '../../common/testing/fake-product-table';
import { PrismaService } from '../../prisma/prisma.service';
import { FiscalService } from '../fiscal/fiscal.service';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  let service: SalesService;
  let products: ReturnType<typeof createFakeProductTable>;
  let tx: {
    customer: { findUnique: jest.Mock };
    product: ReturnType<typeof createFakeProductTable>;
    sale: { create: jest.Mock; findUnique: jest.Mock; updateMany: jest.Mock };
    stockMovement: { createMany: jest.Mock };
    financialEntry: { createMany: jest.Mock; updateMany: jest.Mock; create: jest.Mock };
    fiscalDocument: { create: jest.Mock };
  };
  let prisma: {
    $transaction: jest.Mock;
    sale: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  };
  let fiscalService: { enqueueEmission: jest.Mock };

  beforeEach(async () => {
    products = createFakeProductTable([
      {
        id: 'prod-1',
        name: 'Produto A',
        active: true,
        currentStock: 10,
        salePrice: 25,
        costPrice: 10,
      },
      {
        id: 'prod-2',
        name: 'Produto B',
        active: true,
        currentStock: 5,
        salePrice: 9.9,
        costPrice: 4,
      },
    ]);

    tx = {
      customer: { findUnique: jest.fn().mockResolvedValue({ id: 'cust-1', active: true }) },
      product: products,
      sale: {
        create: jest.fn().mockResolvedValue({ id: 'sale-1', number: 42 }),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stockMovement: { createMany: jest.fn() },
      financialEntry: { createMany: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
      fiscalDocument: { create: jest.fn() },
    };

    prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
      sale: {
        findUnique: jest.fn().mockResolvedValue({ id: 'sale-1', items: [] }),
        findMany: jest.fn(),
        count: jest.fn(),
      },
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

  const stockOf = (id: string) => products.rows.get(id)?.currentStock;
  const createdReceivables = () => tx.financialEntry.createMany.mock.calls[0][0].data;

  describe('create', () => {
    it('records the sale with price/cost snapshot, SAIDA movements, fiscal job and a paid receivable', async () => {
      await service.create(
        {
          items: [
            { productId: 'prod-1', quantity: 3 },
            { productId: 'prod-2', quantity: 2 },
          ],
          paymentMethod: PaymentMethod.PIX,
          discount: 4.8,
        },
        'user-1',
      );

      expect(stockOf('prod-1')).toBe(7);
      expect(stockOf('prod-2')).toBe(3);
      expect(tx.sale.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: SaleStatus.COMPLETED,
          paymentMethod: PaymentMethod.PIX,
          subtotal: 94.8,
          discount: 4.8,
          total: 90,
          items: {
            create: [
              { productId: 'prod-1', quantity: 3, unitPrice: 25, unitCost: 10 },
              { productId: 'prod-2', quantity: 2, unitPrice: 9.9, unitCost: 4 },
            ],
          },
        }),
      });
      expect(tx.stockMovement.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ type: MovementType.SAIDA, quantity: 3, reason: 'Venda #42' }),
          expect.objectContaining({ type: MovementType.SAIDA, quantity: 2, reason: 'Venda #42' }),
        ],
      });
      expect(createdReceivables()).toEqual([
        expect.objectContaining({
          type: FinancialEntryType.RECEIVABLE,
          status: FinancialEntryStatus.PAID,
          amount: 90,
          saleId: 'sale-1',
          paymentMethod: PaymentMethod.PIX,
        }),
      ]);
      expect(tx.fiscalDocument.create).toHaveBeenCalledWith({
        data: { saleId: 'sale-1', provider: 'sandbox', status: FiscalStatus.QUEUED },
      });
      expect(fiscalService.enqueueEmission).toHaveBeenCalledWith('sale-1');
    });

    it('splits an A_PRAZO sale into open monthly installments that add up to the total', async () => {
      await service.create(
        {
          items: [{ productId: 'prod-1', quantity: 4 }],
          paymentMethod: PaymentMethod.A_PRAZO,
          customerId: 'cust-1',
          installments: 3,
          firstDueDate: '2026-11-10',
        },
        'user-1',
      );

      const entries = createdReceivables();
      expect(entries.map((e: { amount: number }) => e.amount)).toEqual([33.34, 33.33, 33.33]);
      expect(entries.every((e: { status: string }) => e.status === FinancialEntryStatus.OPEN)).toBe(
        true,
      );
      expect(entries.map((e: { dueDate: Date }) => e.dueDate.toISOString().slice(0, 10))).toEqual([
        '2026-11-10',
        '2026-12-10',
        '2027-01-10',
      ]);
      expect(entries[0].customerId).toBe('cust-1');
    });

    it('requires a customer for A_PRAZO sales', async () => {
      await expect(
        service.create(
          { items: [{ productId: 'prod-1', quantity: 1 }], paymentMethod: PaymentMethod.A_PRAZO },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a discount larger than the subtotal', async () => {
      await expect(
        service.create({ items: [{ productId: 'prod-1', quantity: 1 }], discount: 30 }, 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.sale.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the product does not exist', async () => {
      await expect(
        service.create({ items: [{ productId: 'missing', quantity: 1 }] }, 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(fiscalService.enqueueEmission).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when stock is insufficient', async () => {
      await expect(
        service.create({ items: [{ productId: 'prod-2', quantity: 6 }] }, 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.sale.create).not.toHaveBeenCalled();
    });

    it('checks the accumulated quantity when the same product appears twice', async () => {
      await expect(
        service.create(
          {
            items: [
              { productId: 'prod-2', quantity: 3 },
              { productId: 'prod-2', quantity: 3 },
            ],
          },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('still returns the sale when the fiscal queue (Redis) is unavailable', async () => {
      fiscalService.enqueueEmission.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.create({ items: [{ productId: 'prod-1', quantity: 1 }] }, 'user-1'),
      ).resolves.toEqual({ id: 'sale-1', items: [] });
    });
  });

  describe('cancel', () => {
    const completedSale = {
      id: 'sale-1',
      number: 42,
      status: SaleStatus.COMPLETED,
      paymentMethod: PaymentMethod.A_PRAZO,
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 3 }],
      financialEntries: [
        { type: FinancialEntryType.RECEIVABLE, status: FinancialEntryStatus.PAID, amount: 50 },
        { type: FinancialEntryType.RECEIVABLE, status: FinancialEntryStatus.OPEN, amount: 50 },
      ],
    };

    it('returns stock, cancels open receivables and refunds what was already paid', async () => {
      tx.sale.findUnique.mockResolvedValue(completedSale);

      await service.cancel('sale-1', { reason: 'Cliente desistiu' }, 'user-1');

      expect(stockOf('prod-1')).toBe(13);
      expect(tx.stockMovement.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ type: MovementType.ENTRADA, quantity: 3 })],
      });
      expect(tx.financialEntry.updateMany).toHaveBeenCalledWith({
        where: {
          saleId: 'sale-1',
          type: FinancialEntryType.RECEIVABLE,
          status: FinancialEntryStatus.OPEN,
        },
        data: { status: FinancialEntryStatus.CANCELLED },
      });
      expect(tx.financialEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: FinancialEntryType.PAYABLE,
          status: FinancialEntryStatus.PAID,
          amount: 50,
          description: 'Estorno da venda #42',
        }),
      });
    });

    it('refuses to cancel a sale twice', async () => {
      tx.sale.findUnique.mockResolvedValue(completedSale);
      tx.sale.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.cancel('sale-1', { reason: 'de novo' }, 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stockOf('prod-1')).toBe(10);
    });
  });

  describe('findOneOrThrow', () => {
    it('throws NotFoundException when the sale does not exist', async () => {
      prisma.sale.findUnique.mockResolvedValue(null);

      await expect(service.findOneOrThrow('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      prisma.sale.findMany.mockResolvedValue([]);
      prisma.sale.count.mockResolvedValue(0);
    });

    it('filters by status', async () => {
      await service.findAll({ page: 1, pageSize: 20, status: SaleStatus.COMPLETED });

      const [findManyArgs] = prisma.sale.findMany.mock.calls[0];
      expect(findManyArgs.where).toEqual({ status: SaleStatus.COMPLETED });
    });

    it('searches by sale number when the term is numeric', async () => {
      await service.findAll({ page: 1, pageSize: 20, search: '42' });

      const [findManyArgs] = prisma.sale.findMany.mock.calls[0];
      expect(findManyArgs.where).toEqual({ number: 42 });
    });
  });
});
