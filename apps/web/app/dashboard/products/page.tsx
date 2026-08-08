import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Category, PaginatedResponse, Product } from '@/lib/types';

interface SearchParams {
  search?: string;
  categoryId?: string;
  active?: string;
  page?: string;
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Number(searchParams.page ?? '1') || 1;
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', '20');
  if (searchParams.search) params.set('search', searchParams.search);
  if (searchParams.categoryId) params.set('categoryId', searchParams.categoryId);
  if (searchParams.active) params.set('active', searchParams.active);

  const [productsPage, categories] = await Promise.all([
    apiFetch<PaginatedResponse<Product>>(`/products?${params.toString()}`),
    apiFetch<Category[]>('/categories'),
  ]);

  const totalPages = Math.max(1, Math.ceil(productsPage.total / productsPage.pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Produtos</h1>
          <p className="text-sm text-slate-500">{productsPage.total} produto(s) encontrado(s)</p>
        </div>
        <Link
          href="/dashboard/products/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Novo produto
        </Link>
      </div>

      <form method="GET" className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="min-w-[240px] flex-1">
          <label htmlFor="search" className="sr-only">
            Buscar por nome, SKU ou codigo de barras
          </label>
          <input
            id="search"
            type="search"
            name="search"
            placeholder="Buscar por nome, SKU ou codigo de barras"
            defaultValue={searchParams.search}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="categoryId" className="sr-only">
            Filtrar por categoria
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={searchParams.categoryId ?? ''}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="active" className="sr-only">
            Filtrar por status
          </label>
          <select
            id="active"
            name="active"
            defaultValue={searchParams.active ?? ''}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Ativos e inativos</option>
            <option value="true">Somente ativos</option>
            <option value="false">Somente inativos</option>
          </select>
        </div>
        <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Filtrar
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">SKU</th>
              <th scope="col" className="px-4 py-3">Nome</th>
              <th scope="col" className="px-4 py-3">Categoria</th>
              <th scope="col" className="px-4 py-3 text-right">Estoque</th>
              <th scope="col" className="px-4 py-3 text-right">Preco</th>
              <th scope="col" className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {productsPage.items.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{product.sku}</td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/products/${product.id}`} className="font-medium text-brand-700 hover:underline">
                    {product.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{product.category?.name ?? '-'}</td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {product.currentStock <= product.minStock ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                      {product.currentStock}
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        baixo
                      </span>
                    </span>
                  ) : (
                    product.currentStock
                  )}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {Number(product.salePrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      product.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {product.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
              </tr>
            ))}
            {productsPage.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 text-sm" aria-label="Paginacao">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={{ pathname: '/dashboard/products', query: { ...searchParams, page: p } }}
              className={`rounded-lg px-3 py-1.5 ${
                p === page ? 'bg-brand-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
