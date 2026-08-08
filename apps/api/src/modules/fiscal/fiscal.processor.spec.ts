import { FiscalStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { FiscalProcessor } from './fiscal.processor';
import { FiscalProvider } from './fiscal-provider.interface';

describe('FiscalProcessor', () => {
  let processor: FiscalProcessor;
  let prisma: {
    sale: { findUnique: jest.Mock };
    fiscalDocument: { update: jest.Mock };
  };
  let provider: { emit: jest.Mock };

  const saleWithItems = {
    id: 'sale-1',
    total: 100,
    items: [
      { quantity: 2, unitPrice: 25, product: { name: 'Produto A' } },
      { quantity: 1, unitPrice: 50, product: { name: 'Produto B' } },
    ],
  };

  beforeEach(() => {
    prisma = {
      sale: { findUnique: jest.fn() },
      fiscalDocument: { update: jest.fn().mockResolvedValue({}) },
    };
    provider = { emit: jest.fn() };

    processor = new FiscalProcessor(
      prisma as unknown as PrismaService,
      provider as unknown as FiscalProvider,
    );
  });

  function job(): Job<{ saleId: string }> {
    return { data: { saleId: 'sale-1' } } as Job<{ saleId: string }>;
  }

  it('does nothing when the sale no longer exists', async () => {
    prisma.sale.findUnique.mockResolvedValue(null);

    await processor.process(job());

    expect(prisma.fiscalDocument.update).not.toHaveBeenCalled();
  });

  it('marks the document ISSUED on a successful emission', async () => {
    prisma.sale.findUnique.mockResolvedValue(saleWithItems);
    provider.emit.mockResolvedValue({
      externalId: 'PROTO-1',
      xmlUrl: 'https://x/nfe.xml',
      pdfUrl: 'https://x/nfe.pdf',
    });

    await processor.process(job());

    expect(prisma.fiscalDocument.update).toHaveBeenNthCalledWith(1, {
      where: { saleId: 'sale-1' },
      data: { status: FiscalStatus.PROCESSING },
    });
    expect(prisma.fiscalDocument.update).toHaveBeenNthCalledWith(2, {
      where: { saleId: 'sale-1' },
      data: {
        status: FiscalStatus.ISSUED,
        externalId: 'PROTO-1',
        xmlUrl: 'https://x/nfe.xml',
        pdfUrl: 'https://x/nfe.pdf',
        errorMessage: null,
      },
    });
    expect(provider.emit).toHaveBeenCalledWith({
      saleId: 'sale-1',
      total: 100,
      items: [
        { productName: 'Produto A', quantity: 2, unitPrice: 25 },
        { productName: 'Produto B', quantity: 1, unitPrice: 50 },
      ],
    });
  });

  it('marks the document FAILED and rethrows when the provider errors', async () => {
    prisma.sale.findUnique.mockResolvedValue(saleWithItems);
    provider.emit.mockRejectedValue(new Error('provedor indisponivel'));

    await expect(processor.process(job())).rejects.toThrow('provedor indisponivel');

    expect(prisma.fiscalDocument.update).toHaveBeenNthCalledWith(2, {
      where: { saleId: 'sale-1' },
      data: { status: FiscalStatus.FAILED, errorMessage: 'provedor indisponivel' },
    });
  });
});
