import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { deactivateProductAction, updateProductAction } from '@/actions/products';
import { Category, PaginatedResponse, Product, Supplier } from '@/lib/types';
import { ProductForm } from '../ProductForm';

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  let product: Product;

  try {
    product = await apiFetch<Product>(`/products/${params.id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const [categories, suppliersPage] = await Promise.all([
    apiFetch<Category[]>('/categories'),
    apiFetch<PaginatedResponse<Supplier>>('/suppliers?pageSize=100'),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>
          <p className="text-sm text-slate-500">
            SKU {product.sku} - estoque atual: {product.currentStock}
          </p>
        </div>
        {product.active && (
          <form action={deactivateProductAction.bind(null, product.id)}>
            <button
              type="submit"
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Desativar
            </button>
          </form>
        )}
      </div>

      <ProductForm
        action={updateProductAction.bind(null, product.id)}
        product={product}
        categories={categories}
        suppliers={suppliersPage.items}
        submitLabel="Salvar alteracoes"
      />
    </div>
  );
}
