'use client';

import { useActionState } from 'react';
import { updateCompanySettingsAction } from '@/actions/company';
import { AddressFields } from '@/components/address/AddressFields';
import { Field, SelectField } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/FormMessage';
import { SubmitButton } from '@/components/ui/SubmitButton';
import type { CompanySettings } from '@/lib/types';

export function CompanySettingsForm({ settings }: { settings: CompanySettings }) {
  const [state, formAction] = useActionState(updateCompanySettingsAction, {});

  return (
    <form action={formAction} className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Ambiente de <strong>homologação</strong>: as notas são autorizadas por uma SEFAZ simulada, sem certificado
        digital e sem valor fiscal. Os dados abaixo vêm preenchidos com uma empresa fictícia; troque à vontade.
      </div>

      <fieldset className="card grid gap-4 p-6 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-slate-900">Emitente</legend>
        <Field label="Razão social" name="legalName" defaultValue={settings.legalName} required maxLength={60} className="sm:col-span-2" />
        <Field label="Nome fantasia" name="tradeName" defaultValue={settings.tradeName ?? ''} maxLength={60} />
        <Field label="Telefone" name="phone" type="tel" defaultValue={settings.phone ?? ''} />
        <Field label="CNPJ" name="cnpj" defaultValue={settings.cnpj} required inputMode="numeric" hint="Validado pelo dígito verificador (rejeição 207)." />
        <Field label="Inscrição estadual" name="stateRegistration" defaultValue={settings.stateRegistration} required inputMode="numeric" />
        <SelectField
          label="Regime tributário (CRT)"
          name="taxRegime"
          defaultValue={String(settings.taxRegime)}
          options={[
            { value: '1', label: '1 - Simples Nacional' },
            { value: '4', label: '4 - MEI' },
          ]}
          className="sm:col-span-2"
        />
        <AddressFields values={settings} required />
      </fieldset>

      <fieldset className="card grid gap-4 p-6 sm:grid-cols-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">Numeração</legend>
        <Field label="Série NF-e" name="nfeSeries" type="number" min={1} max={999} defaultValue={settings.nfeSeries} />
        <Field label="Próximo nº NF-e" name="nfeNextNumber" type="number" min={1} defaultValue={settings.nfeNextNumber} />
        <Field label="Série NFC-e" name="nfceSeries" type="number" min={1} max={999} defaultValue={settings.nfceSeries} />
        <Field label="Próximo nº NFC-e" name="nfceNextNumber" type="number" min={1} defaultValue={settings.nfceNextNumber} />
        <p className="text-xs text-slate-500 sm:col-span-4">
          Cada série tem numeração própria. Voltar o número para um já usado faz a nota ser recusada por duplicidade.
        </p>
      </fieldset>

      <fieldset className="card grid gap-4 p-6 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-slate-900">NFC-e e SEFAZ simulada</legend>
        <Field label="Id do CSC" name="cscId" defaultValue={settings.cscId} inputMode="numeric" maxLength={6} hint="Código de Segurança do Contribuinte, usado no QR Code da NFC-e." />
        <Field
          label="CSC (token)"
          name="cscToken"
          type="password"
          autoComplete="off"
          minLength={16}
          maxLength={36}
          placeholder="Deixe em branco para manter o atual"
        />
        <label className="flex items-start gap-3 text-sm sm:col-span-2">
          <input type="checkbox" name="simulateSefazOffline" defaultChecked={settings.simulateSefazOffline} className="mt-1" />
          <span>
            <span className="font-medium text-slate-900">Simular SEFAZ fora do ar</span>
            <span className="block text-slate-500">
              As próximas notas ficam com &quot;Falha de comunicação&quot; (código 108) e são reenviadas automaticamente.
              Desmarque e use Reenviar para ver a nota ser autorizada.
            </span>
          </span>
        </label>
      </fieldset>

      <FormMessage state={state} />
      <SubmitButton label="Salvar configurações" />
    </form>
  );
}
