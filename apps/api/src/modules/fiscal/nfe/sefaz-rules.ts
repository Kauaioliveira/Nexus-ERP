import {
  isRestrictedGtin,
  isValidCnpj,
  isValidCpf,
  isValidGtin,
  onlyDigits,
  UF_CODES,
} from './brazil';
import { NfeData } from './nfe-types';

// Validacoes que a SEFAZ faz antes de autorizar a nota, com os codigos
// (cStat) e mensagens (xMotivo) do Manual de Orientacao do Contribuinte.
// A SEFAZ simulada para na primeira regra violada, como a real.

export interface Rejection {
  statusCode: number;
  statusMessage: string;
}

const reject = (statusCode: number, statusMessage: string): Rejection => ({
  statusCode,
  statusMessage,
});

const toCents = (value: number) => Math.round(value * 100);

export function validateForAuthorization(data: NfeData): Rejection | null {
  const emitter = data.emitter;

  if (data.environment !== 2) {
    return reject(252, 'Rejeição: Ambiente informado diverge do Ambiente de recebimento');
  }
  if (!isValidCnpj(emitter.cnpj)) {
    return reject(207, 'Rejeição: CNPJ do emitente inválido');
  }
  if (!onlyDigits(emitter.stateRegistration)) {
    return reject(209, 'Rejeição: IE do emitente inválida');
  }
  if (!UF_CODES[emitter.address.state] || !/^\d{7}$/.test(emitter.address.cityCode)) {
    return reject(225, 'Rejeição: Falha no Schema XML da NFe (endereço do emitente incompleto)');
  }

  const dest = data.recipient;
  if (data.model === 55 && !dest) {
    return reject(225, 'Rejeição: Falha no Schema XML da NFe (NF-e exige destinatário)');
  }
  if (dest) {
    const doc = onlyDigits(dest.document);
    if (doc.length === 11 && !isValidCpf(doc))
      return reject(237, 'Rejeição: CPF do destinatário inválido');
    if (doc.length === 14 && !isValidCnpj(doc))
      return reject(208, 'Rejeição: CNPJ do destinatário inválido');
    if (doc.length !== 11 && doc.length !== 14)
      return reject(237, 'Rejeição: CPF do destinatário inválido');
    if (data.model === 55) {
      const addr = dest.address;
      if (
        !addr ||
        !addr.street ||
        !addr.number ||
        !addr.district ||
        !UF_CODES[addr.state] ||
        !/^\d{7}$/.test(addr.cityCode)
      ) {
        return reject(
          225,
          'Rejeição: Falha no Schema XML da NFe (endereço do destinatário incompleto)',
        );
      }
    }
  }

  let productsCents = 0;
  let discountCents = 0;
  for (const item of data.items) {
    if (!/^\d{8}$/.test(item.ncm ?? '')) {
      return reject(
        778,
        `Rejeição: Informado NCM inexistente [nItem: ${data.items.indexOf(item) + 1}]`,
      );
    }
    if (item.gtin && (!isValidGtin(item.gtin) || isRestrictedGtin(item.gtin))) {
      return reject(611, `Rejeição: cEAN inválido [nItem: ${data.items.indexOf(item) + 1}]`);
    }
    if (item.cest && !/^\d{7}$/.test(item.cest)) {
      return reject(225, 'Rejeição: Falha no Schema XML da NFe (CEST inválido)');
    }
    if (!/^5\d{3}$/.test(item.cfop) && !/^6\d{3}$/.test(item.cfop)) {
      return reject(225, 'Rejeição: Falha no Schema XML da NFe (CFOP de saída inválido)');
    }
    productsCents += toCents(item.grossTotal);
    discountCents += toCents(item.discount);
  }

  if (productsCents !== toCents(data.totals.products)) {
    return reject(564, 'Rejeição: Total do Produto / Serviço difere do somatório dos itens');
  }
  if (discountCents !== toCents(data.totals.discount)) {
    return reject(533, 'Rejeição: Total do desconto difere do somatório dos itens');
  }
  if (productsCents - discountCents !== toCents(data.totals.total)) {
    return reject(
      610,
      'Rejeição: Total da NF difere do somatório dos Valores compõe o valor Total da NF.',
    );
  }

  const paidCents = data.payments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
  if (paidCents - toCents(data.change) < toCents(data.totals.total)) {
    return reject(865, 'Rejeição: Total dos pagamentos menor que o total da nota');
  }

  return null;
}

// Prazos legais de cancelamento: 24 horas para a NF-e e, na maior parte
// das UFs (incluindo SP), 30 minutos para a NFC-e.
export const CANCEL_DEADLINE_MINUTES = { 55: 24 * 60, 65: 30 } as const;

export function validateCancellation(
  model: 55 | 65,
  authorizedAt: Date,
  reason: string,
  now = new Date(),
): Rejection | null {
  if (reason.trim().length < 15) {
    return reject(
      225,
      'Rejeição: Falha no Schema XML (justificativa precisa ter ao menos 15 caracteres)',
    );
  }
  const elapsedMinutes = (now.getTime() - authorizedAt.getTime()) / 60_000;
  if (elapsedMinutes > CANCEL_DEADLINE_MINUTES[model]) {
    return reject(501, 'Rejeição: Prazo de cancelamento superior ao previsto na Legislação');
  }
  return null;
}
