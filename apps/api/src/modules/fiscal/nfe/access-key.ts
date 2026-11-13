// Chave de acesso da NF-e/NFC-e (44 digitos), no formato do Manual de
// Orientacao do Contribuinte (MOC):
//   cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8) cDV(1)
// O digito verificador e o modulo 11 com pesos 2..9 da direita para a esquerda.

export interface AccessKeyParts {
  ufCode: number; // codigo IBGE da UF (ex: 35 = SP)
  issuedAt: Date;
  cnpj: string;
  model: 55 | 65;
  series: number;
  number: number;
  emissionType: number; // tpEmis: 1 = normal, 9 = contingencia offline NFC-e
  randomCode: number; // cNF, 8 digitos
}

export function mod11CheckDigit(digits: string): number {
  let weight = 2;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

const pad = (value: number | string, size: number) => String(value).padStart(size, '0');

export function buildAccessKey(parts: AccessKeyParts): string {
  const cnpj = parts.cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) throw new Error('CNPJ do emitente deve ter 14 digitos.');

  // AAMM no fuso do negocio (UTC-3), igual a data de emissao do XML.
  const local = new Date(parts.issuedAt.getTime() - 3 * 60 * 60 * 1000);
  const yymm = pad(local.getUTCFullYear() % 100, 2) + pad(local.getUTCMonth() + 1, 2);

  const base =
    pad(parts.ufCode, 2) +
    yymm +
    cnpj +
    pad(parts.model, 2) +
    pad(parts.series, 3) +
    pad(parts.number, 9) +
    String(parts.emissionType) +
    pad(parts.randomCode, 8);

  return base + mod11CheckDigit(base);
}

export function isValidAccessKey(key: string): boolean {
  return /^\d{44}$/.test(key) && mod11CheckDigit(key.slice(0, 43)) === Number(key[43]);
}

// "3526 1111 2223 3300 0181 6500 1000 0000 0110 0000 0019" - como no DANFE.
export function formatAccessKey(key: string): string {
  return key.replace(/(\d{4})(?=\d)/g, '$1 ');
}
