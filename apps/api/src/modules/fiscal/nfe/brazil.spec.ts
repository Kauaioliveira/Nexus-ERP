import { isRestrictedGtin, isValidCnpj, isValidCpf, isValidGtin } from './brazil';

describe('validacoes brasileiras', () => {
  it('valida CPF e CNPJ pelo digito verificador', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false);
  });

  it('valida GTIN-8, GTIN-12 e GTIN-13', () => {
    expect(isValidGtin('7891000315507')).toBe(true);
    expect(isValidGtin('7891000315508')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true);
    expect(isValidGtin('036000291452')).toBe(true);
    expect(isValidGtin('MER-001')).toBe(false);
  });

  it('identifica codigos de uso interno (prefixo 2)', () => {
    expect(isRestrictedGtin('2000000000015')).toBe(true);
    expect(isRestrictedGtin('7891000315507')).toBe(false);
  });
});
