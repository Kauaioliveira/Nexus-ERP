import { buildAccessKey, formatAccessKey, isValidAccessKey, mod11CheckDigit } from './access-key';

describe('chave de acesso', () => {
  it('calcula o digito verificador modulo 11', () => {
    // Exemplo do MOC: base de 43 digitos com DV conhecido.
    expect(mod11CheckDigit('5206043300991100250655012000000780026730161')).toBe(5);
  });

  it('monta a chave com 44 digitos e DV valido', () => {
    const key = buildAccessKey({
      ufCode: 35,
      issuedAt: new Date('2026-11-12T15:00:00Z'),
      cnpj: '11.222.333/0001-81',
      model: 65,
      series: 1,
      number: 123,
      emissionType: 1,
      randomCode: 12345678,
    });

    expect(key).toHaveLength(44);
    expect(
      key.startsWith('352611' + '11222333000181' + '65' + '001' + '000000123' + '1' + '12345678'),
    ).toBe(true);
    expect(isValidAccessKey(key)).toBe(true);
  });

  it('usa o mes no fuso de Brasilia', () => {
    const key = buildAccessKey({
      ufCode: 35,
      issuedAt: new Date('2026-12-01T01:00:00Z'), // ainda 30/11 em UTC-3
      cnpj: '11222333000181',
      model: 55,
      series: 1,
      number: 1,
      emissionType: 1,
      randomCode: 1,
    });
    expect(key.slice(2, 6)).toBe('2611');
  });

  it('rejeita chave com DV errado e formata em blocos de 4', () => {
    expect(isValidAccessKey('1'.repeat(44))).toBe(false);
    expect(formatAccessKey('12345678')).toBe('1234 5678');
  });
});
