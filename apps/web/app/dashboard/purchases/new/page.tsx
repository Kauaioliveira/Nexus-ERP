import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import type { PaginatedResponse, Supplier } from '@/lib/types';
import { PurchaseOrderForm } from '@/components/purchases/PurchaseOrderForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Novo pedido de compra' };

export default async function NewPurchasePage(props: {
  searchParams: Promise<{ supplierId?: string }>;
}) {
  await requireAdmin();
  const { supplierId } = await props.searchParams;
  const suppliers = await apiFetch<PaginatedResponse<Supplier>>('/suppliers?active=true&pageSize=100');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo pedido de compra"
        description="O custo sugerido é o custo médio atual do produto."
      />
      <PurchaseOrderForm suppliers={suppliers.items} defaultSupplierId={supplierId} />
    </div>
  );
}
