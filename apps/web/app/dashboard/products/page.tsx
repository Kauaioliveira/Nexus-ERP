import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { apiFetch } from '@/lib/api';
import { Category, PaginatedResponse, Product } from '@/lib/types';

export const metadata: Metadata = { title: 'Produtos' };

interface SearchParams {
  search?: string;
  categoryId?: string;
  active?: string;
  page?: string;
}

export default async function ProductsPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
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
      <PageHeader
        title="Produtos"
        description={`${productsPage.total} produto(s) encontrado(s)`}
        actions={
          <Link href="/dashboard/products/new" className="btn-primary">
            Novo produto
          </Link>
        }
      />

      <form method="GET" className="card flex flex-wrap gap-3 p-4">
        <div className="min-w-[240px] flex-1">
          <label htmlFor="search" className="sr-only">
            Buscar por nome, SKU ou código de barras
          </label>
          <input
            id="search"
            type="search"
            name="search"
            placeholder="Buscar por nome, SKU ou código de barras"
            defaultValue={searchParams.search}
            className="input"
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
            className="input"
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
            className="input"
          >
            <option value="">Ativos e inativos</option>
            <option value="true">Somente ativos</option>
            <option value="false">Somente inativos</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="table-head">
            <tr>
              <th scope="col" className="px-4 py-3">SKU</th>
              <th scope="col" className="px-4 py-3">Nome</th>
              <th scope="col" className="px-4 py-3">Categoria</th>
              <th scope="col" className="px-4 py-3 text-right">Estoque</th>
              <th scope="col" className="px-4 py-3 text-right">Preço</th>
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
