'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { Search } from 'lucide-react';
import { barcodeLookupAction, type BarcodeLookupResult } from '@/actions/products';
import { Field, SelectField } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/FormMessage';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { CameraScanButton } from '@/components/scan/CameraScanner';
import { ActionState, Category, Product, Supplier } from '@/lib/types';

interface ProductFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  product?: Product;
  categories: Category[];
  suppliers: Supplier[];
  submitLabel: string;
  initialBarcode?: string;
}

const ORIGIN_OPTIONS = [
  { value: '0', label: '0 - Nacional' },
  { value: '1', label: '1 - Estrangeira, importação direta' },
  { value: '2', label: '2 - Estrangeira, adquirida no mercado interno' },
  { value: '3', label: '3 - Nacional, conteúdo importado > 40%' },
  { value: '4', label: '4 - Nacional, processos produtivos básicos' },
  { value: '5', label: '5 - Nacional, conteúdo importado ≤ 40%' },
  { value: '6', label: '6 - Estrangeira, importação direta, sem similar (CAMEX)' },
  { value: '7', label: '7 - Estrangeira, mercado interno, sem similar (CAMEX)' },
  { value: '8', label: '8 - Nacional, conteúdo importado > 70%' },
];

const CSOSN_OPTIONS = [
  { value: '102', label: '102 - Tributada pelo Simples sem permissão de crédito' },
  { value: '103', label: '103 - Isenção do ICMS no Simples para a faixa de receita' },
  { value: '300', label: '300 - Imune' },
  { value: '400', label: '400 - Não tributada pelo Simples' },
  { value: '500', label: '500 - ICMS cobrado anteriormente por substituição tributária' },
];

const SOURCE_LABELS = { cosmos: 'Cosmos (Bluesoft)', openfoodfacts: 'Open Food Facts' } as const;

export function ProductForm({
  action,
  product,
  categories,
  suppliers,
  submitLabel,
  initialBarcode,
}: ProductFormProps) {
  const [state, formAction] = useActionState(action, {});
  const [values, setValues] = useState({
    barcode: product?.barcode ?? initialBarcode ?? '',
    sku: product?.sku ?? initialBarcode ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    ncm: product?.ncm ?? '',
    cest: product?.cest ?? '',
  });
  const [lookup, setLookup] = useState<BarcodeLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const autoLookupDone = useRef(false);

  function set(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function runLookup(rawCode: string) {
    const code = rawCode.trim();
    if (!code) return;
    setLookupError(null);
    startTransition(async () => {
      const result = await barcodeLookupAction(code);
      if (!result) {
        setLookup(null);
        setLookupError('Não foi possível consultar o código agora.');
        return;
      }
      setLookup(result);
      setValues((current) => {
        const next = { ...current, barcode: code };
        // SKU padrao = codigo de barras, quando o usuario ainda nao escolheu outro.
        if (!product && (!current.sku || current.sku === current.barcode)) next.sku = code;
        const suggestion = result.suggestion;
        if (suggestion && !result.product) {
          const name = [suggestion.name, suggestion.quantity].filter(Boolean).join(' ');
          if (!current.name) next.name = name.slice(0, 160);
          if (!current.description && suggestion.brand) next.description = `Marca: ${suggestion.brand}`;
          if (!current.ncm && suggestion.ncm) next.ncm = suggestion.ncm;
          if (!current.cest && suggestion.cest) next.cest = suggestion.cest;
        }
        return next;
      });
    });
  }

  useEffect(() => {
    if (initialBarcode && !product && !autoLookupDone.current) {
      autoLookupDone.current = true;
      runLookup(initialBarcode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const duplicate = lookup?.product && lookup.product.id !== product?.id ? lookup.product : null;

  return (
    <form action={formAction} className="space-y-6">
      <div className="card grid gap-4 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="barcode" className="label">
            Código de barras (EAN/GTIN)
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="barcode"
              name="barcode"
              className="input"
              inputMode="numeric"
              autoComplete="off"
              value={values.barcode}
              onChange={(event) => set('barcode', event.target.value)}
              onKeyDown={(event) => {
                // Leitores USB "digitam" o codigo e terminam com Enter:
                // consulta em vez de enviar o formulario.
                if (event.key === 'Enter') {
                  event.preventDefault();
                  runLookup(values.barcode);
                }
              }}
              placeholder="Bipe com o leitor, use a câmera ou digite"
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => runLookup(values.barcode)}
              disabled={pending || !values.barcode.trim()}
            >
              <Search className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{pending ? 'Buscando...' : 'Identificar'}</span>
            </button>
            <CameraScanButton onDetected={(code) => runLookup(code)} />
          </div>
          <div aria-live="polite" className="mt-2 text-sm">
            {lookupError && <p className="text-amber-700">{lookupError}</p>}
            {lookup && !lookup.validGtin && (
              <p className="text-amber-700">
                {lookup.code} não é um GTIN válido (dígito verificador). Na nota ele sai como &quot;SEM GTIN&quot;.
              </p>
            )}
            {lookup?.restricted && (
              <p className="text-slate-600">Código de uso interno (prefixo 2): na nota ele sai como &quot;SEM GTIN&quot;.</p>
            )}
            {duplicate && (
              <p className="text-red-700" role="alert">
                Já existe um produto com este código:{' '}
                <Link href={`/dashboard/products/${duplicate.id}`} className="font-medium underline">
                  {duplicate.name}
                </Link>
                .
              </p>
            )}
            {lookup?.suggestion && !lookup.product && (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                {lookup.suggestion.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lookup.suggestion.imageUrl} alt="" className="h-14 w-14 rounded object-contain" />
                )}
                <p>
                  Identificado em {SOURCE_LABELS[lookup.suggestion.source]}: <strong>{lookup.suggestion.name}</strong>
                  {lookup.suggestion.brand && ` · ${lookup.suggestion.brand}`}
                  {lookup.suggestion.ncm && ` · NCM ${lookup.suggestion.ncm}`}. Os campos vazios foram preenchidos;
                  confira antes de salvar.
                </p>
              </div>
            )}
            {lookup && lookup.validGtin && !lookup.restricted && !lookup.product && !lookup.suggestion && (
              <p className="text-slate-600">
                Código válido, mas não encontrado nas bases consultadas. Preencha os dados manualmente.
              </p>
            )}
          </div>
        </div>

        <Field
          label="SKU (código interno)"
          name="sku"
          value={values.sku}
          onChange={(event) => set('sku', event.target.value)}
          required
          hint="Por padrão, igual ao código de barras."
        />
        <Field label="Unidade" name="unit" defaultValue={product?.unit ?? 'UN'} hint="UN, KG, CX, L..." />
        <Field
          label="Nome"
          name="name"
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
          required
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <label htmlFor="description" className="label">
            Descrição
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            value={values.description}
            onChange={(event) => set('description', event.target.value)}
            className="input mt-1"
          />
        </div>
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
        <Field label="Estoque mínimo" name="minStock" type="number" min={0} defaultValue={product?.minStock ?? 0} hint="Abaixo disso o produto aparece em Repor estoque." />
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
      </div>

      <fieldset className="card grid gap-4 p-6 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-slate-900">Dados fiscais (NF-e / NFC-e)</legend>
        <Field
          label="NCM"
          name="ncm"
          value={values.ncm}
          onChange={(event) => set('ncm', event.target.value)}
          inputMode="numeric"
          maxLength={10}
          placeholder="8 dígitos"
          hint="Obrigatório para emitir nota (sem ele a SEFAZ rejeita com 778)."
        />
        <Field
          label="CEST"
          name="cest"
          value={values.cest}
          onChange={(event) => set('cest', event.target.value)}
          inputMode="numeric"
          maxLength={9}
          placeholder="7 dígitos, se houver ST"
        />
        <Field
          label="CFOP"
          name="cfop"
          defaultValue={product?.cfop ?? '5102'}
          inputMode="numeric"
          maxLength={4}
          hint="5102 = venda de mercadoria de terceiros dentro do estado."
        />
        <SelectField label="Origem da mercadoria" name="origin" defaultValue={String(product?.origin ?? 0)} options={ORIGIN_OPTIONS} />
        <SelectField
          label="CSOSN (Simples Nacional)"
          name="csosn"
          defaultValue={product?.csosn ?? '102'}
          options={CSOSN_OPTIONS}
          className="sm:col-span-2"
        />
      </fieldset>

      <FormMessage state={state} />
      <SubmitButton label={submitLabel} />
    </form>
  );
}
