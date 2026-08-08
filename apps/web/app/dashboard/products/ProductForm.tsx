'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { ActionState, Category, Product, Supplier } from '@/lib/types';

const initialState: ActionState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Salvando...' : label}
    </button>
  );
}

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
  textarea?: boolean;
  className?: string;
  min?: number;
  step?: string;
}

function Field({ label, name, type = 'text', defaultValue, required, textarea, className, ...rest }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          defaultValue={defaultValue as string}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          {...rest}
        />
      )}
    </div>
  );
}

interface ProductFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  product?: Product;
  categories: Category[];
  suppliers: Supplier[];
  submitLabel: string;
}

export function ProductForm({ action, product, categories, suppliers, submitLabel }: ProductFormProps) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
      <Field label="SKU" name="sku" defaultValue={product?.sku} required />
      <Field label="Codigo de barras" name="barcode" defaultValue={product?.barcode ?? ''} />
      <Field label="Nome" name="name" defaultValue={product?.name} required className="sm:col-span-2" />
      <Field label="Descricao" name="description" defaultValue={product?.description ?? ''} textarea className="sm:col-span-2" />
      <Field label="Unidade" name="unit" defaultValue={product?.unit ?? 'UN'} />
      <Field label="Estoque minimo" name="minStock" type="number" min={0} defaultValue={product?.minStock ?? 0} />
      <Field label="Preco de custo (R$)" name="costPrice" type="number" min={0} step="0.01" defaultValue={product?.costPrice} required />
      <Field label="Preco de venda (R$)" name="salePrice" type="number" min={0} step="0.01" defaultValue={product?.salePrice} required />

      <div>
        <label htmlFor="categoryId" className="block text-sm font-medium text-slate-700">
          Categoria
        </label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={product?.categoryId ?? ''}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Sem categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="supplierId" className="block text-sm font-medium text-slate-700">
          Fornecedor
        </label>
        <select
          id="supplierId"
          name="supplierId"
          defaultValue={product?.supplierId ?? ''}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Sem fornecedor</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 sm:col-span-2">
          {state.error}
        </p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
