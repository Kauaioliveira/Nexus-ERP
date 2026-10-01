import type { Metadata } from 'next';
import { createPartnerAction } from '@/actions/partners';
import { PartnerForm } from '@/components/partners/PartnerForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Novo cliente' };

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Novo cliente" />
      <PartnerForm action={createPartnerAction.bind(null, 'customers')} kind="customer" submitLabel="Cadastrar" />
    </div>
  );
}
