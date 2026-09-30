import type { Metadata } from 'next';
import { createPartnerAction } from '@/actions/partners';
import { PartnerForm } from '@/components/partners/PartnerForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Novo fornecedor' };

export default function NewSupplierPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Novo fornecedor" />
      <PartnerForm action={createPartnerAction.bind(null, 'suppliers')} kind="supplier" submitLabel="Cadastrar" />
    </div>
  );
}
