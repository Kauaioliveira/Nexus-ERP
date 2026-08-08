import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { fiscalProviderFactory } from './fiscal-provider.factory';
import { FISCAL_EMISSION_QUEUE } from './fiscal.constants';
import { FiscalProcessor } from './fiscal.processor';
import { FiscalService } from './fiscal.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: FISCAL_EMISSION_QUEUE,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: false,
      },
    }),
  ],
  providers: [FiscalService, FiscalProcessor, fiscalProviderFactory],
  exports: [FiscalService],
})
export class FiscalModule {}
