import { NfeData, SefazResult } from './nfe/nfe-types';

// Abstracao sobre quem autoriza a nota. O restante do sistema monta a
// nota (dados + XML 4.00) e so conhece esta interface; trocar a SEFAZ
// simulada por um provedor real (Focus NFe, PlugNotas, NFe.io) ou pela
// SEFAZ direto e implementar um novo adapter.

export interface FiscalAuthorizationRequest {
  data: NfeData;
  xml: string;
  // Liga a indisponibilidade simulada (so a SEFAZ simulada respeita).
  simulateOffline?: boolean;
}

export interface FiscalCancelRequest {
  model: 55 | 65;
  accessKey: string;
  cnpj: string;
  environment: number;
  authorizationProtocol: string;
  authorizedAt: Date;
  reason: string;
  simulateOffline?: boolean;
}

export interface FiscalProvider {
  readonly name: string;
  // Devolve cStat 100 (autorizada) ou uma rejeicao. Lanca
  // FiscalUnavailableError quando nao ha comunicacao.
  authorize(request: FiscalAuthorizationRequest): Promise<SefazResult>;
  // Devolve cStat 135 (evento registrado) ou uma rejeicao.
  cancel(request: FiscalCancelRequest): Promise<SefazResult>;
}

export class FiscalUnavailableError extends Error {
  readonly statusCode = 108;
  constructor(message = 'Serviço Paralisado Momentaneamente (curto prazo)') {
    super(message);
    this.name = 'FiscalUnavailableError';
  }
}
