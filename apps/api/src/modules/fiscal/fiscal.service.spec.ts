import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { FISCAL_EMISSION_QUEUE } from './fiscal.constants';
import { FiscalService } from './fiscal.service';

describe('FiscalService', () => {
  let service: FiscalService;
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FiscalService, { provide: getQueueToken(FISCAL_EMISSION_QUEUE), useValue: queue }],
    }).compile();

    service = module.get<FiscalService>(FiscalService);
  });

  it('enqueues an emission job with retry options', async () => {
    await service.enqueueEmission('sale-1');

    expect(queue.add).toHaveBeenCalledWith(
      'emit',
      { saleId: 'sale-1' },
      expect.objectContaining({ attempts: 3, backoff: { type: 'exponential', delay: 2_000 } }),
    );
  });
});
