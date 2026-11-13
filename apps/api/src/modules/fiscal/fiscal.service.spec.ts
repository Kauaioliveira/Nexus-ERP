import { FiscalModel, FiscalStatus, PaymentMethod, SaleStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { DEFAULT_COMPANY_SETTINGS } from '../company/company-defaults';
import { FiscalUnavailableError } from './fiscal-provider.interface';
import { FiscalService } from './fiscal.service';
import { isValidAccessKey } from './nfe/access-key';
import { SandboxFiscalProvider } from './providers/sandbox-fiscal.provider';

describe('FiscalService', () => {
  const settings = {
    id: 1,
    ...DEFAULT_COMPANY_SETTINGS,
    nfeSeries: 1,
    nfeNextNumber: 1,
    nfceSeries: 1,
    nfceNextNumber: 1,
    simulateSefazOffline: false,
    updatedAt: new Date(),
  };

  const product = (overrides: Record<string, unknown> = {}) => ({
    id: 'p1',
    sku: 'CAF-001',
    barcode: '7891000315507',
    name: 'Café 500g',
    unit: 'UN',
    ncm: '09012100',
    cest: null,
    cfop: '5102',
    origin: 0,
    csosn: '102',
    ...overrides,
  });

  const saleWith = (overrides: Record<string, unknown> = {}, productOverrides = {}) => ({
    id: 'sale-1',
    number: 7,
    status: SaleStatus.COMPLETED,
    paymentMethod: PaymentMethod.PIX,
    subtotal: 30,
    discount: 1,
    total: 29,
    customer: null,
    items: [
      { quantity: 2, unitPrice: 10, product: product(productOverrides) },
      { quantity: 1, unitPrice: 10, product: product({ id: 'p2', sku: 'ACU-1', barcode: null }) },
    ],
    fiscalDocument: {
      status: FiscalStatus.QUEUED,
      model: FiscalModel.NFCE,
      series: null,
      number: null,
      buyerDocument: '52998224725',
    },
    ...overrides,
  });

  let prisma: {
    sale: { findUnique: jest.Mock };
    fiscalDocument: { update: jest.Mock; findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let company: { get: jest.Mock; reserveNumber: jest.Mock };
  let queue: { add: jest.Mock };
  let provider: SandboxFiscalProvider;
  let service: FiscalService;

  const lastUpdate = () => prisma.fiscalDocument.update.mock.calls.at(-1)?.[0].data;

  beforeEach(() => {
    prisma = {
      sale: { findUnique: jest.fn() },
      fiscalDocument: { update: jest.fn().mockResolvedValue({}), findUnique: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    company = {
      get: jest.fn().mockResolvedValue({ ...settings }),
      reserveNumber: jest.fn().mockResolvedValue({ series: 1, number: 15 }),
    };
    queue = { add: jest.fn().mockResolvedValue({}) };
    provider = new SandboxFiscalProvider(0);
    service = new FiscalService(
      queue as unknown as Queue,
      prisma as unknown as PrismaService,
      company as unknown as CompanyService,
      provider,
    );
  });

  it('enfileira a emissao com retry', async () => {
    await service.enqueueEmission('sale-1');
    expect(queue.add).toHaveBeenCalledWith(
      'emit',
      { saleId: 'sale-1' },
      expect.objectContaining({ attempts: 3, backoff: { type: 'exponential', delay: 2_000 } }),
    );
  });

  it('autoriza a NFC-e com numero reservado, chave valida, XML e QR Code', async () => {
    prisma.sale.findUnique.mockResolvedValue(saleWith());

    await service.processEmission('sale-1');

    expect(company.reserveNumber).toHaveBeenCalledWith(prisma, FiscalModel.NFCE);
    const data = lastUpdate();
    expect(data.status).toBe(FiscalStatus.ISSUED);
    expect(data.statusCode).toBe(100);
    expect(isValidAccessKey(data.accessKey)).toBe(true);
    expect(data.accessKey.slice(20, 22)).toBe('65');
    expect(data.protocol).toMatch(/^\d{15}$/);
    expect(data.qrCodeUrl).toContain(`?p=${data.accessKey}|2|2|1|`);
    expect(data.xml).toContain('<nfeProc');
    expect(data.xml).toContain('<cStat>100</cStat>');
    expect(data.xml).toContain('<CPF>52998224725</CPF>');
    expect(data.xml).toContain(
      '<tPag>17</tPag><vPag>29.00</vPag><card><tpIntegra>2</tpIntegra></card>',
    );
    // Desconto de R$ 1 rateado: 0,66 + 0,34.
    expect(data.xml).toContain('<vDesc>0.66</vDesc>');
    expect(data.xml).toContain('<vDesc>0.34</vDesc>');
    expect(data.xml).toContain('<cEAN>SEM GTIN</cEAN>');
    expect(data.xml).toContain('<vNF>29.00</vNF>');
  });

  it('marca como rejeitada (sem repetir) quando falta NCM', async () => {
    prisma.sale.findUnique.mockResolvedValue(saleWith({}, { ncm: null }));

    await expect(service.processEmission('sale-1')).resolves.toBeUndefined();

    expect(lastUpdate()).toMatchObject({
      status: FiscalStatus.REJECTED,
      statusCode: 778,
      accessKey: null,
    });
  });

  it('reaproveita o numero no reenvio', async () => {
    prisma.sale.findUnique.mockResolvedValue(
      saleWith({
        fiscalDocument: {
          status: FiscalStatus.REJECTED,
          model: FiscalModel.NFCE,
          series: 1,
          number: 9,
        },
      }),
    );

    await service.processEmission('sale-1');

    expect(company.reserveNumber).not.toHaveBeenCalled();
    expect(lastUpdate().accessKey.slice(25, 34)).toBe('000000009');
  });

  it('registra falha e relanca quando a SEFAZ esta fora do ar', async () => {
    company.get.mockResolvedValue({ ...settings, simulateSefazOffline: true });
    prisma.sale.findUnique.mockResolvedValue(saleWith());

    await expect(service.processEmission('sale-1')).rejects.toBeInstanceOf(FiscalUnavailableError);
    expect(lastUpdate()).toMatchObject({ status: FiscalStatus.FAILED, statusCode: 108 });
  });

  it('nao emite nota de venda cancelada', async () => {
    prisma.sale.findUnique.mockResolvedValue(saleWith({ status: SaleStatus.CANCELLED }));

    await service.processEmission('sale-1');

    expect(lastUpdate()).toMatchObject({ status: FiscalStatus.NOT_REQUESTED });
    expect(company.reserveNumber).not.toHaveBeenCalled();
  });

  describe('cancelamento', () => {
    const issued = (minutesAgo: number, model: FiscalModel = FiscalModel.NFCE) => ({
      status: FiscalStatus.ISSUED,
      model,
      accessKey: '35261111222333000181650010000000151123456780',
      protocol: '135260000000001',
      environment: 2,
      authorizedAt: new Date(Date.now() - minutesAgo * 60_000),
    });

    it('homologa o evento dentro do prazo', async () => {
      prisma.fiscalDocument.findUnique.mockResolvedValue(issued(5));

      await service.cancelAuthorized('sale-1', 'Cliente desistiu da compra');

      expect(lastUpdate()).toMatchObject({ status: FiscalStatus.CANCELLED, statusCode: 135 });
      expect(lastUpdate().cancelXml).toContain('<tpEvento>110111</tpEvento>');
    });

    it('recusa NFC-e depois de 30 minutos, mas aceita NF-e dentro de 24 horas', async () => {
      prisma.fiscalDocument.findUnique.mockResolvedValue(issued(45));
      await expect(
        service.cancelAuthorized('sale-1', 'Cliente desistiu da compra'),
      ).rejects.toThrow(/501/);

      prisma.fiscalDocument.findUnique.mockResolvedValue(issued(45, FiscalModel.NFE));
      await expect(
        service.cancelAuthorized('sale-1', 'Cliente desistiu da compra'),
      ).resolves.toBeUndefined();
    });

    it('exige justificativa de 15 caracteres', async () => {
      prisma.fiscalDocument.findUnique.mockResolvedValue(issued(1));
      await expect(service.cancelAuthorized('sale-1', 'desistiu')).rejects.toThrow(/15 caracteres/);
    });

    it('nao faz nada quando a nota nao foi autorizada', async () => {
      prisma.fiscalDocument.findUnique.mockResolvedValue({ status: FiscalStatus.REJECTED });
      await service.cancelAuthorized('sale-1', 'qualquer motivo aqui');
      expect(prisma.fiscalDocument.update).not.toHaveBeenCalled();
    });
  });
});
