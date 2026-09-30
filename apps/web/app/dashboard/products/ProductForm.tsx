'use client';

import { useActionState } from 'react';
import { Field, SelectField, TextArea } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/FormMessage';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { ActionState, Category, Product, Supplier } from '@/lib/types';

interface ProductFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  product?: Product;
  categories: Category[];
  suppliers: Supplier[];
  submitLabel: string;
}

export function ProductForm({ action, product, categories, suppliers, submitLabel }: ProductFormProps) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="card grid gap-4 p-6 sm:grid-cols-2">
      <Field label="SKU (código interno)" name="sku" defaultValue={product?.sku} required />
      <Field label="Código de barras" name="barcode" defaultValue={product?.barcode ?? ''} />
      <Field label="Nome" name="name" defaultValue={product?.name} required className="sm:col-span-2" />
      <TextArea label="Descrição" name="description" defaultValue={product?.description} className="sm:col-span-2" />
      <Field label="Unidade" name="unit" defaultValue={product?.unit ?? 'UN'} hint="UN, KG, CX, L..." />
      <Field label="Estoque mínimo" name="minStock" type="number" min={0} defaultValue={product?.minStock ?? 0} hint="Abaixo disso o produto aparece em Repor estoque." />
      <Field
        label="Preço de custo (R$)"
        name="costPrice"
        type="number"
        min={0}
        step="0.01"
        defaultValue={product?.costPrice}
        required
        hint={product ? 'Atualizado automaticamente (custo médio) a cada compra recebida.' : undefined}
      />
      <Field label="Preço de venda (R$)" name="salePrice" type="number" min={0} step="0.01" defaultValue={product?.salePrice} required />
      <SelectField
        label="Categoria"
        name="categoryId"
        defaultValue={product?.categoryId}
        placeholder="Sem categoria"
        options={categories.map((category) => ({ value: category.id, label: category.name }))}
      />
      <SelectField
        label="Fornecedor principal"
        name="supplierId"
        defaultValue={product?.supplierId}
        placeholder="Sem fornecedor"
        options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
      />
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
