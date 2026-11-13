'use client';

import { useState, useTransition } from 'react';
import { lookupCepAction } from '@/actions/cep';

export interface AddressValues {
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  district?: string | null;
  city?: string | null;
  cityCode?: string | null;
  state?: string | null;
}

const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');

// Endereco estruturado (o que a NF-e exige). Ao sair do campo CEP, consulta
// o ViaCEP e preenche rua, bairro, cidade, UF e codigo IBGE.
export function AddressFields({ values, required = false }: { values?: AddressValues; required?: boolean }) {
  const [address, setAddress] = useState({
    zipCode: values?.zipCode ?? '',
    street: values?.street ?? '',
    number: values?.number ?? '',
    district: values?.district ?? '',
    city: values?.city ?? '',
    cityCode: values?.cityCode ?? '',
    state: values?.state ?? '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (field: keyof typeof address) => (event: { target: { value: string } }) =>
    setAddress((current) => ({ ...current, [field]: event.target.value }));

  function lookup() {
    const cep = address.zipCode.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setMessage(null);
    startTransition(async () => {
      const found = await lookupCepAction(cep);
      if (!found) {
        setMessage('CEP não encontrado (ou sem internet). Preencha o endereço manualmente.');
        return;
      }
      setAddress((current) => ({
        ...current,
        zipCode: found.zipCode,
        street: found.street || current.street,
        district: found.district || current.district,
        city: found.city,
        cityCode: found.cityCode,
        state: found.state,
      }));
    });
  }

  const input = (field: keyof typeof address, label: string, extra: Record<string, unknown> = {}, className = '') => (
    <div className={className}>
      <label htmlFor={field} className="label">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={field}
        name={field}
        value={address[field]}
        onChange={set(field)}
        required={required}
        className="input mt-1"
        {...extra}
      />
    </div>
  );

  return (
    <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-6">
      <legend className="label mb-2">Endereço</legend>
      {input('zipCode', 'CEP', { inputMode: 'numeric', maxLength: 9, onBlur: lookup, placeholder: '00000-000' }, 'sm:col-span-2')}
      {input('street', 'Logradouro', { maxLength: 60 }, 'sm:col-span-3')}
      {input('number', 'Número', { maxLength: 60, placeholder: 'S/N' }, 'sm:col-span-1')}
      {input('district', 'Bairro', { maxLength: 60 }, 'sm:col-span-2')}
      {input('city', 'Cidade', { maxLength: 60 }, 'sm:col-span-2')}
      <div className="sm:col-span-1">
        <label htmlFor="state" className="label">
          UF{required && <span className="text-red-500"> *</span>}
        </label>
        <select id="state" name="state" value={address.state} onChange={set('state')} required={required} className="input mt-1">
          <option value="">--</option>
          {UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
      </div>
      {input('cityCode', 'Cód. IBGE', { inputMode: 'numeric', maxLength: 7, pattern: '\\d{7}', title: '7 dígitos' }, 'sm:col-span-1')}
      <p className="text-xs text-slate-500 sm:col-span-6" aria-live="polite">
        {pending ? 'Consultando CEP...' : (message ?? 'Digite o CEP para preencher o resto automaticamente. A NF-e exige o código IBGE do município.')}
      </p>
    </fieldset>
  );
}
