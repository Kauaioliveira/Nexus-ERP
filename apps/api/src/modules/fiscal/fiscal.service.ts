import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { FISCAL_EMISSION_QUEUE } from './fiscal.constants';

export interface FiscalEmissionJobData {
  saleId: string;
}

@Injectable()
export class FiscalService {
  constructor(@InjectQueue(FISCAL_EMISSION_QUEUE) private readonly queue: Queue) {}

  // Enfileira a emissao da NF-e para processamento assincrono. Chamado
  // apos a venda ja estar commitada no banco (nunca de dentro da
  // transacao), para nao acoplar a disponibilidade do Redis a criacao da
  // venda em si.
  async enqueueEmission(saleId: string): Promise<void> {
    await this.queue.add(
      'emit',
      { saleId } satisfies FiscalEmissionJobData,
      { attempts: 3, backoff: { type: 'exponential', delay: 2_000 } },
    );
  }
}
