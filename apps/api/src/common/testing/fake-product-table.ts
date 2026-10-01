// Tabela de produtos em memoria que reproduz a semantica do UPDATE
// condicional usado em applyStockDelta (where currentStock >= n +
// increment). Permite testar as regras de saldo sem banco de dados.
export interface FakeProduct {
  id: string;
  name: string;
  active: boolean;
  currentStock: number;
  costPrice?: number;
  salePrice?: number;
}

export function createFakeProductTable(initial: FakeProduct[]) {
  const rows = new Map(initial.map((product) => [product.id, { ...product }]));

  return {
    rows,
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
      const row = rows.get(where.id);
      return row ? { ...row } : null;
    }),
    updateMany: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string; active?: boolean; currentStock?: { gte: number } };
        data: { currentStock: { increment: number } };
      }) => {
        const row = rows.get(where.id);
        const matches =
          row !== undefined &&
          (where.active === undefined || row.active === where.active) &&
          (where.currentStock === undefined || row.currentStock >= where.currentStock.gte);

        if (!matches || !row) return { count: 0 };
        row.currentStock += data.currentStock.increment;
        return { count: 1 };
      },
    ),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Omit<Partial<FakeProduct>, 'currentStock'> & {
          currentStock?: number | { increment: number };
        };
      }) => {
        const row = rows.get(where.id);
        if (!row) return null;
        const { currentStock, ...rest } = data;
        Object.assign(row, rest);
        if (typeof currentStock === 'number') row.currentStock = currentStock;
        else if (currentStock) row.currentStock += currentStock.increment;
        return { ...row };
      },
    ),
  };
}
