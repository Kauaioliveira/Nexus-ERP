import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { deactivateProductAction, updateProductAction } from '@/actions/products';
import { formatMoney } from '@/lib/format';
import { getCurrentUser } from '@/lib/session';
import { Category, PaginatedResponse, Product, Supplier } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { ProductForm } from '../ProductForm';

export const metadata: Metadata = { title: 'Produto' };

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let product: Product;

  try {
    product = await apiFetch<Product>(`/products/${id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const [categories, suppliersPage, user] = await Promise.all([
    apiFetch<Category[]>('/categories'),
    apiFetch<PaginatedResponse<Supplier>>('/suppliers?pageSize=100'),
    getCurrentUser(),
  ]);

  const isAdmin = user?.role === 'ADMIN';
  const cost = Number(product.costPrice);
  const price = Number(product.salePrice);
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
  const low = product.currentStock <= product.minStock;

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={
          <span className="inline-flex items-center gap-2">
            SKU {product.sku}
            {!product.active && <Badge>Inativo</Badge>}
          </span>
        }
        actions={
          <>
            <Link href={`/dashboard/stock?productId=${product.id}`} className="btn-secondary">
              Ver movimentações
            </Link>
            {isAdmin && product.active && (
              <form action={deactivateProductAction.bind(null, product.id)}>
                <SubmitButton
                  label="Desativar"
                  pendingLabel="Desativando..."
                  variant="danger"
                  confirmMessage="Desativar este produto? O histórico é mantido."
                />
              </form>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Estoque atual"
          value={`${product.currentStock} ${product.unit}`}
          hint={`Mínimo: ${product.minStock}`}
          tone={low ? 'warning' : 'default'}
        />
        <StatCard label="Preço de venda" value={formatMoney(price)} />
        {isAdmin && (
          <StatCard
            label="Margem bruta"
            value={`${margin.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
            hint={`Custo médio ${formatMoney(cost)}`}
            tone={margin > 0 ? 'positive' : 'negative'}
          />
        )}
      </div>

      {isAdmin ? (
        <ProductForm
          action={updateProductAction.bind(null, product.id)}
          product={product}
          categories={categories}
          suppliers={suppliersPage.items}
          submitLabel="Salvar alterações"
        />
      ) : (
        <div className="card space-y-1 p-6 text-sm text-slate-700">
          <p>Código de barras: {product.barcode ?? '-'}</p>
          <p>Categoria: {product.category?.name ?? '-'}</p>
          <p>{product.description}</p>
        </div>
      )}
    </div>
  );
}
