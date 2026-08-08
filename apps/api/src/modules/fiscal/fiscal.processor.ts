import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { FiscalStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { FiscalEmissionJobData } from './fiscal.service';
import { FiscalProvider } from './fiscal-provider.interface';
import { FISCAL_EMISSION_QUEUE, FISCAL_PROVIDER } from './fiscal.constants';

@Processor(FISCAL_EMISSION_QUEUE)
export class FiscalProcessor extends WorkerHost {
  private readonly logger = new Logger(FiscalProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FISCAL_PROVIDER) private readonly fiscalProvider: FiscalProvider,
  ) {
    super();
  }

  async process(job: Job<FiscalEmissionJobData>): Promise<void> {
    const { saleId } = job.data;

    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: { include: { product: true } } },
    });

    if (!sale) {
      // Venda nao existe mais (nao deveria acontecer) - descarta o job
      // sem tentar de novo.
      this.logger.warn(`Venda ${saleId} nao encontrada, descartando job de emissao fiscal.`);
      return;
    }

    await this.prisma.fiscalDocument.update({
      where: { saleId },
      data: { status: FiscalStatus.PROCESSING },
    });

    try {
      const result = await this.fiscalProvider.emit({
        saleId,
        total: Number(sale.total),
        items: sale.items.map((item) => ({
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        })),
      });

      await this.prisma.fiscalDocument.update({
        where: { saleId },
        data: {
          status: FiscalStatus.ISSUED,
          externalId: result.externalId,
          xmlUrl: result.xmlUrl,
          pdfUrl: result.pdfUrl,
          errorMessage: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';

      await this.prisma.fiscalDocument.update({
        where: { saleId },
        data: { status: FiscalStatus.FAILED, errorMessage: message },
      });

      // Relanca para que o BullMQ conte como falha e aplique o retry
      // configurado (3 tentativas, backoff exponencial).
      throw error;
    }
  }
}
