import { Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  FiscalAuthorizationRequest,
  FiscalCancelRequest,
  FiscalProvider,
  FiscalUnavailableError,
} from '../fiscal-provider.interface';
import { SefazResult } from '../nfe/nfe-types';
import { validateCancellation, validateForAuthorization } from '../nfe/sefaz-rules';

// SEFAZ simulada em ambiente de homologacao. Aplica as mesmas validacoes
// de negocio da SEFAZ real (CNPJ, NCM, GTIN, totais, prazo de
// cancelamento...) e responde com os mesmos codigos, mas nenhuma nota e
// enviada a lugar nenhum: nao precisa de certificado digital nem de
// credenciamento, e nada tem valor fiscal.
export class SandboxFiscalProvider implements FiscalProvider {
  readonly name = 'sandbox';
  private readonly logger = new Logger(SandboxFiscalProvider.name);

  constructor(private readonly latencyMs = 300) {}

  // nProt: 1 digito do autorizador + cUF + ano (2) + sequencial (10).
  private protocol(accessKey: string): string {
    const year = new Date().getUTCFullYear() % 100;
    return `1${accessKey.slice(0, 2)}${String(year).padStart(2, '0')}${String(randomInt(0, 10_000_000_000)).padStart(10, '0')}`;
  }

  private async roundTrip(simulateOffline?: boolean) {
    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    if (simulateOffline) throw new FiscalUnavailableError();
  }

  async authorize(request: FiscalAuthorizationRequest): Promise<SefazResult> {
    await this.roundTrip(request.simulateOffline);
    const receivedAt = new Date();
    const key = request.data.accessKey;

    const rejection = validateForAuthorization(request.data);
    if (rejection) {
      this.logger.warn(
        `[sandbox] nota ${key} rejeitada: ${rejection.statusCode} ${rejection.statusMessage}`,
      );
      return { ...rejection, receivedAt };
    }

    this.logger.log(`[sandbox] nota ${key} autorizada`);
    return {
      statusCode: 100,
      statusMessage: 'Autorizado o uso da NF-e',
      protocol: this.protocol(key),
      receivedAt,
    };
  }

  async cancel(request: FiscalCancelRequest): Promise<SefazResult> {
    await this.roundTrip(request.simulateOffline);
    const receivedAt = new Date();

    const rejection = validateCancellation(
      request.model,
      request.authorizedAt,
      request.reason,
      receivedAt,
    );
    if (rejection) return { ...rejection, receivedAt };

    return {
      statusCode: 135,
      statusMessage: 'Evento registrado e vinculado a NF-e',
      protocol: this.protocol(request.accessKey),
      receivedAt,
    };
  }
}
