import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FISCAL_EMISSION_QUEUE } from './fiscal.constants';
import { FiscalEmissionJobData, FiscalService } from './fiscal.service';

@Processor(FISCAL_EMISSION_QUEUE)
export class FiscalProcessor extends WorkerHost {
  constructor(private readonly fiscalService: FiscalService) {
    super();
  }

  async process(job: Job<FiscalEmissionJobData>): Promise<void> {
    await this.fiscalService.processEmission(job.data.saleId);
  }
}
