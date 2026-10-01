import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { PointOfSale } from '@/components/sales/PointOfSale';

export const metadata: Metadata = { title: 'Nova venda' };

export default function NewSalePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nova venda"
        description="Busque os produtos (ou use o leitor de código de barras), escolha o pagamento e finalize."
      />
      <PointOfSale />
    </div>
  );
}
