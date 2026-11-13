import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BarcodeLookupService } from './barcode-lookup.service';

describe('BarcodeLookupService', () => {
  const findFirst = jest.fn();
  const prisma = { product: { findFirst } } as unknown as PrismaService;
  const config = (values: Record<string, string>) =>
    ({ get: (key: string) => values[key] }) as unknown as ConfigService;
  const fetchMock = jest.fn();

  beforeEach(() => {
    findFirst.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('devolve o produto do cadastro sem consultar a base externa', async () => {
    findFirst.mockResolvedValue({ id: 'p1', name: 'Café' });
    const service = new BarcodeLookupService(prisma, config({}));

    const result = await service.lookup('7891000315507');

    expect(result.product).toEqual({ id: 'p1', name: 'Café' });
    expect(result.validGtin).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sugere nome e marca pelo Open Food Facts quando o produto nao existe', async () => {
    findFirst.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        product: { product_name_pt: 'Leite em pó', brands: 'Ninho, Nestlé', quantity: '400 g' },
      }),
    });
    const service = new BarcodeLookupService(prisma, config({}));

    const result = await service.lookup('7891000315507');

    expect(result.suggestion).toMatchObject({
      name: 'Leite em pó',
      brand: 'Ninho',
      quantity: '400 g',
      source: 'openfoodfacts',
    });
  });

  it('procura tambem nas outras bases abertas (higiene, produtos em geral, pet)', async () => {
    findFirst.mockResolvedValue(null);
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('openproductsfacts')
          ? { status: 1, product: { product_name: 'Pilha alcalina AA', brands: 'Marca' } }
          : { status: 0 },
    }));
    const service = new BarcodeLookupService(prisma, config({}));

    const result = await service.lookup('7891000315507');

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.suggestion).toMatchObject({
      name: 'Pilha alcalina AA',
      source: 'openproductsfacts',
    });
  });

  it('usa o Cosmos (com NCM) quando ha token', async () => {
    findFirst.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        description: 'REFRIGERANTE COLA 2L',
        brand: { name: 'Marca' },
        ncm: { code: '2202.10.00' },
      }),
    });
    const service = new BarcodeLookupService(prisma, config({ COSMOS_TOKEN: 'token' }));

    const result = await service.lookup('7891000315507');

    expect(result.suggestion).toMatchObject({
      name: 'REFRIGERANTE COLA 2L',
      ncm: '22021000',
      source: 'cosmos',
    });
  });

  it('nao consulta fora para codigo invalido, interno ou com a consulta desligada', async () => {
    findFirst.mockResolvedValue(null);

    expect(
      (await new BarcodeLookupService(prisma, config({})).lookup('ABC-1')).suggestion,
    ).toBeNull();
    expect(
      (await new BarcodeLookupService(prisma, config({})).lookup('2000000000015')).restricted,
    ).toBe(true);
    expect(
      (
        await new BarcodeLookupService(prisma, config({ BARCODE_LOOKUP: 'off' })).lookup(
          '7891000315507',
        )
      ).suggestion,
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('segue sem sugestao quando a base externa falha', async () => {
    findFirst.mockResolvedValue(null);
    fetchMock.mockRejectedValue(new Error('offline'));

    const result = await new BarcodeLookupService(prisma, config({})).lookup('7891000315507');

    expect(result.suggestion).toBeNull();
  });
});
