import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FiscalModel, FiscalStatus, SaleStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { FiscalProvider, FiscalUnavailableError } from './fiscal-provider.interface';
import { FISCAL_EMISSION_QUEUE, FISCAL_PROVIDER } from './fiscal.constants';
import { buildAccessKey } from './nfe/access-key';
import { UF_CODES } from './nfe/brazil';
import { NFCE_CONSULT_URL, buildNfceQrCodeUrl } from './nfe/nfce-qrcode';
import { buildNfeData } from './nfe/nfe-builder';
import { buildCancelEventXml, buildNfeXml, wrapAuthorizedXml } from './nfe/nfe-xml';

export interface FiscalEmissionJobData {
  saleId: string;
}

const modelCode = (model: FiscalModel) => (model === FiscalModel.NFE ? 55 : 65);

// Campos grandes (XML) ficam fora das listagens e do detalhe da venda.
export const FISCAL_DOCUMENT_SUMMARY = {
  id: true,
  provider: true,
  model: true,
  status: true,
  environment: true,
  series: true,
  number: true,
  accessKey: true,
  protocol: true,
  statusCode: true,
  statusMessage: true,
  buyerDocument: true,
  qrCodeUrl: true,
  authorizedAt: true,
  cancelledAt: true,
  cancelProtocol: true,
  cancelReason: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class FiscalService {
  private readonly logger = new Logger(FiscalService.name);

  constructor(
    @InjectQueue(FISCAL_EMISSION_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
    @Inject(FISCAL_PROVIDER) private readonly provider: FiscalProvider,
  ) {}

  // Enfileira a emissao para processamento assincrono. Chamado apos a
  // venda ja estar commitada (nunca de dentro da transacao), para nao
  // acoplar a disponibilidade do Redis a criacao da venda.
  async enqueueEmission(saleId: string): Promise<void> {
    await this.queue.add('emit', { saleId } satisfies FiscalEmissionJobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
    });
  }

  // Monta a nota (numero, chave, XML 4.00, QR Code) e pede a autorizacao.
  // Rejeicao nao e tentada de novo: o dado precisa ser corrigido e a nota
  // reenviada. Falha de comunicacao relanca o erro para o BullMQ repetir.
  async processEmission(saleId: string): Promise<void> {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: { include: { product: true } }, customer: true, fiscalDocument: true },
    });
    const document = sale?.fiscalDocument;

    if (!sale || !document) {
      this.logger.warn(`Venda ${saleId} sem documento fiscal; descartando job.`);
      return;
    }
    if (document.status === FiscalStatus.ISSUED || document.status === FiscalStatus.CANCELLED) {
      return;
    }
    if (sale.status === SaleStatus.CANCELLED) {
      await this.prisma.fiscalDocument.update({
        where: { saleId },
        data: {
          status: FiscalStatus.NOT_REQUESTED,
          errorMessage: 'Venda cancelada antes da autorização.',
        },
      });
      return;
    }

    // Numero da nota reservado uma unica vez: um reenvio apos rejeicao
    // reaproveita o mesmo numero, como permite a SEFAZ.
    const numbering = await this.prisma.$transaction(async (tx) => {
      await tx.fiscalDocument.update({
        where: { saleId },
        data: { status: FiscalStatus.PROCESSING },
      });
      if (document.number && document.series)
        return { series: document.series, number: document.number };
      const reserved = await this.companyService.reserveNumber(tx, document.model);
      await tx.fiscalDocument.update({ where: { saleId }, data: reserved });
      return reserved;
    });

    const settings = await this.companyService.get();
    const model = modelCode(document.model);
    const issuedAt = new Date();
    const randomCode = randomInt(1, 100_000_000);
    const accessKey = buildAccessKey({
      ufCode: UF_CODES[settings.state] ?? 35,
      issuedAt,
      cnpj: settings.cnpj,
      model,
      series: numbering.series,
      number: numbering.number,
      emissionType: 1,
      randomCode,
    });

    const data = buildNfeData({
      sale,
      settings,
      model,
      ...numbering,
      randomCode,
      issuedAt,
      accessKey,
      buyerDocument: document.buyerDocument,
    });
    const qrCodeUrl =
      model === 65
        ? buildNfceQrCodeUrl(accessKey, settings.environment, settings.cscId, settings.cscToken)
        : null;
    if (qrCodeUrl) data.qrCode = { url: qrCodeUrl, consultUrl: NFCE_CONSULT_URL };
    const xml = buildNfeXml(data);

    try {
      const result = await this.provider.authorize({
        data,
        xml,
        simulateOffline: settings.simulateSefazOffline,
      });

      if (result.statusCode === 100) {
        await this.prisma.fiscalDocument.update({
          where: { saleId },
          data: {
            status: FiscalStatus.ISSUED,
            provider: this.provider.name,
            environment: settings.environment,
            accessKey,
            protocol: result.protocol,
            externalId: result.protocol,
            statusCode: result.statusCode,
            statusMessage: result.statusMessage,
            qrCodeUrl,
            xml: wrapAuthorizedXml(xml, accessKey, settings.environment, result),
            authorizedAt: result.receivedAt,
            errorMessage: null,
          },
        });
        return;
      }

      await this.prisma.fiscalDocument.update({
        where: { saleId },
        data: {
          status: FiscalStatus.REJECTED,
          accessKey: null,
          statusCode: result.statusCode,
          statusMessage: result.statusMessage,
          errorMessage: `${result.statusCode} - ${result.statusMessage}`,
        },
      });
    } catch (error) {
      const unavailable = error instanceof FiscalUnavailableError;
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      await this.prisma.fiscalDocument.update({
        where: { saleId },
        data: {
          status: FiscalStatus.FAILED,
          statusCode: unavailable ? error.statusCode : null,
          statusMessage: unavailable ? message : null,
          errorMessage: unavailable ? `${error.statusCode} - ${message}` : message,
        },
      });
      // Relanca para o BullMQ contar a falha e aplicar o retry.
      throw error;
    }
  }

  // Cancela na SEFAZ uma nota autorizada. Chamado pelo cancelamento da
  // venda antes de devolver o estoque: se a SEFAZ recusar (prazo vencido,
  // justificativa curta), a venda continua de pe.
  async cancelAuthorized(saleId: string, reason: string): Promise<void> {
    const document = await this.prisma.fiscalDocument.findUnique({ where: { saleId } });
    if (!document || document.status !== FiscalStatus.ISSUED) return;
    if (!document.accessKey || !document.protocol || !document.authorizedAt) {
      throw new BadRequestException('Nota sem chave ou protocolo; não é possível cancelar.');
    }

    const settings = await this.companyService.get();
    const justification = reason.trim().slice(0, 255);
    const requestedAt = new Date();
    let result;
    try {
      result = await this.provider.cancel({
        model: modelCode(document.model),
        accessKey: document.accessKey,
        cnpj: settings.cnpj,
        environment: document.environment,
        authorizationProtocol: document.protocol,
        authorizedAt: document.authorizedAt,
        reason: justification,
        simulateOffline: settings.simulateSefazOffline,
      });
    } catch (error) {
      if (error instanceof FiscalUnavailableError) {
        throw new BadRequestException(
          `SEFAZ indisponível (${error.statusCode} - ${error.message}). Tente cancelar de novo em instantes.`,
        );
      }
      throw error;
    }

    if (result.statusCode !== 135) {
      const deadline = document.model === FiscalModel.NFCE ? '30 minutos' : '24 horas';
      const hint =
        result.statusCode === 501
          ? ` O prazo de cancelamento da ${document.model === FiscalModel.NFCE ? 'NFC-e' : 'NF-e'} é de ${deadline}; depois disso a devolução é feita com uma nota de entrada.`
          : '';
      throw new BadRequestException(
        `A SEFAZ recusou o cancelamento: ${result.statusCode} - ${result.statusMessage}.${hint}`,
      );
    }

    await this.prisma.fiscalDocument.update({
      where: { saleId },
      data: {
        status: FiscalStatus.CANCELLED,
        cancelledAt: result.receivedAt,
        cancelProtocol: result.protocol,
        cancelReason: justification,
        statusCode: result.statusCode,
        statusMessage: result.statusMessage,
        cancelXml: buildCancelEventXml(
          {
            accessKey: document.accessKey,
            cnpj: settings.cnpj,
            environment: document.environment,
            authorizationProtocol: document.protocol,
            reason: justification,
            requestedAt,
          },
          result,
        ),
      },
    });
  }

  async getXml(saleId: string, kind: 'nfe' | 'cancel') {
    const document = await this.prisma.fiscalDocument.findUnique({ where: { saleId } });
    const xml = kind === 'nfe' ? document?.xml : document?.cancelXml;
    if (!document || !xml) {
      throw new NotFoundException(
        kind === 'nfe' ? 'Nota ainda não autorizada.' : 'Nota sem cancelamento.',
      );
    }
    const suffix =
      kind === 'nfe'
        ? document.model === FiscalModel.NFE
          ? 'procNFe'
          : 'procNFCe'
        : 'procEventoCanc';
    return { xml, fileName: `${document.accessKey}-${suffix}.xml` };
  }
}
