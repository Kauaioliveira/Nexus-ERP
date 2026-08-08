import { apiFetch } from '@/lib/api';
import { createProductAction } from '@/actions/products';
import { Category, PaginatedResponse, Supplier } from '@/lib/types';
import { ProductForm } from '../ProductForm';

export default async function NewProductPage() {
  const [categories, suppliersPage] = await Promise.all([
    apiFetch<Category[]>('/categories'),
    apiFetch<PaginatedResponse<Supplier>>('/suppliers?pageSize=100'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Novo produto</h1>
        <p className="text-sm text-slate-500">Cadastre um produto no catalogo.</p>
      </div>
      <ProductForm
        action={createProductAction}
        categories={categories}
        suppliers={suppliersPage.items}
        submitLabel="Criar produto"
      />
    </div>
  );
}
