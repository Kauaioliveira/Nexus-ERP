import { Injectable, Logger } from '@nestjs/common';
import {
  FiscalEmissionInput,
  FiscalEmissionResult,
  FiscalProvider,
} from '../fiscal-provider.interface';

// Simula a resposta de uma API de NF-e como servico (Focus NFe, PlugNotas,
// NFe.io) em modo homologacao/sandbox: nenhuma nota fiscal real e emitida,
// nenhum CNPJ ou certificado digital e necessario. Serve para desenvolver
// e demonstrar o fluxo completo sem depender de credenciais de producao.
@Injectable()
export class SandboxFiscalProvider implements FiscalProvider {
  private readonly logger = new Logger(SandboxFiscalProvider.name);

  async emit(input: FiscalEmissionInput): Promise<FiscalEmissionResult> {
    this.logger.log(`[sandbox] emitindo NF-e simulada para a venda ${input.saleId}`);

    // Latencia artificial para se aproximar do comportamento de uma
    // chamada HTTP real a um provedor externo.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const protocol = `SANDBOX-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

    return {
      externalId: protocol,
      xmlUrl: `https://sandbox.fiscal.local/nfe/${protocol}.xml`,
      pdfUrl: `https://sandbox.fiscal.local/nfe/${protocol}.pdf`,
    };
  }
}
