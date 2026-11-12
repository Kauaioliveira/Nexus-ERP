// Codigos IBGE das UFs (cUF), usados na chave de acesso e no XML.
export const UF_CODES: Record<string, number> = {
  RO: 11,
  AC: 12,
  AM: 13,
  RR: 14,
  PA: 15,
  AP: 16,
  TO: 17,
  MA: 21,
  PI: 22,
  CE: 23,
  RN: 24,
  PB: 25,
  PE: 26,
  AL: 27,
  SE: 28,
  BA: 29,
  MG: 31,
  ES: 32,
  RJ: 33,
  SP: 35,
  PR: 41,
  SC: 42,
  RS: 43,
  MS: 50,
  MT: 51,
  GO: 52,
  DF: 53,
};

export const onlyDigits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

function allSameDigits(digits: string) {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || allSameDigits(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || allSameDigits(cnpj)) return false;
  const digit = (len: number) => {
    const weights =
      len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, weight, i) => acc + Number(cnpj[i]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

export function isValidCpfOrCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  return digits.length === 11 ? isValidCpf(digits) : isValidCnpj(digits);
}

// GTIN-8, GTIN-12 (UPC-A), GTIN-13 (EAN-13) e GTIN-14: digito verificador
// modulo 10 com pesos 3 e 1 alternados a partir da direita.
export function isValidGtin(value: string): boolean {
  const gtin = onlyDigits(value);
  if (gtin !== value.trim() || ![8, 12, 13, 14].includes(gtin.length)) return false;
  const body = gtin.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const fromRight = body.length - i;
    sum += Number(body[i]) * (fromRight % 2 === 1 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(gtin[gtin.length - 1]);
}

// Codigos que comecam com 2 (GTIN-13) sao de uso interno/restrito
// (balanca, etiquetas da propria loja) e nao vao no campo cEAN da nota.
export function isRestrictedGtin(value: string): boolean {
  const gtin = onlyDigits(value);
  return gtin.length === 13 && gtin.startsWith('2');
}
