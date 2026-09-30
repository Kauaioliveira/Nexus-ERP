import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/session';
import { EntryForm } from '@/components/finance/EntryForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Novo lançamento' };

export default async function NewEntryPage(props: { searchParams: Promise<{ type?: string }> }) {
  await requireAdmin();
  const { type } = await props.searchParams;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo lançamento"
        description="Despesas e receitas que não vêm de vendas ou compras (aluguel, energia, salários...)."
      />
      <EntryForm defaultType={type === 'RECEIVABLE' ? 'RECEIVABLE' : 'PAYABLE'} />
    </div>
  );
}
