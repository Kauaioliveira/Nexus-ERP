// Estrutura intermediaria da nota, independente de banco e de provedor.
// O builder monta isto a partir da venda; o gerador de XML e a SEFAZ
// simulada so leem esta estrutura.

export type NfeModel = 55 | 65;

export interface NfeAddress {
  street: string;
  number: string;
  district: string;
  cityCode: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string | null;
}

export interface NfeEmitter {
  cnpj: string;
  legalName: string;
  tradeName?: string | null;
  stateRegistration: string;
  taxRegime: number;
  address: NfeAddress;
}

export interface NfeRecipient {
  document: string; // CPF ou CNPJ, so digitos
  name?: string | null;
  email?: string | null;
  address?: NfeAddress | null;
}

export interface NfeItem {
  code: string;
  gtin?: string | null;
  description: string;
  ncm?: string | null;
  cest?: string | null;
  cfop: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  grossTotal: number;
  discount: number;
  origin: number;
  csosn: string;
}

// tPag: 01 dinheiro, 03 credito, 04 debito, 05 credito loja, 15 boleto, 17 PIX.
export interface NfePayment {
  method: string;
  amount: number;
  deferred: boolean;
}

export interface NfeData {
  model: NfeModel;
  environment: number;
  series: number;
  number: number;
  randomCode: number;
  issuedAt: Date;
  emissionType: number;
  accessKey: string;
  emitter: NfeEmitter;
  recipient?: NfeRecipient | null;
  items: NfeItem[];
  totals: { products: number; discount: number; total: number };
  payments: NfePayment[];
  change: number;
  additionalInfo?: string | null;
  qrCode?: { url: string; consultUrl: string } | null;
}

export interface SefazResult {
  statusCode: number;
  statusMessage: string;
  protocol?: string;
  receivedAt: Date;
}

export const HOMOLOGATION_RECIPIENT_NAME =
  'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
export const HOMOLOGATION_FIRST_ITEM =
  'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
