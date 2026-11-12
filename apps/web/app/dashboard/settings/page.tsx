import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import type { CompanySettings } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { CompanySettingsForm } from './CompanySettingsForm';

export const metadata: Metadata = { title: 'Empresa e fiscal' };

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await apiFetch<CompanySettings>('/company-settings');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresa e fiscal"
        description="Dados do emitente, numeração das notas e opções da SEFAZ simulada (homologação)."
      />
      <CompanySettingsForm settings={settings} />
    </div>
  );
}
