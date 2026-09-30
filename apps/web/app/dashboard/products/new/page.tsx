import { apiFetch } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import { createProductAction } from '@/actions/products';
import { Category, PaginatedResponse, Supplier } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProductForm } from '../ProductForm';

export default async function NewProductPage() {
  await requireAdmin();
  const [categories, suppliersPage] = await Promise.all([
    apiFetch<Category[]>('/categories'),
    apiFetch<PaginatedResponse<Supplier>>('/suppliers?pageSize=100'),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Novo produto" description="Cadastre um produto no catálogo." />
      <ProductForm
        action={createProductAction}
        categories={categories}
        suppliers={suppliersPage.items}
        submitLabel="Criar produto"
      />
    </div>
  );
}
