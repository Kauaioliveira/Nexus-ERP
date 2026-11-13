import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import bwipjs from 'bwip-js/node';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PAYMENT_METHOD_LABELS,
  formatAccessKey,
  formatDateTime,
  formatDocument,
  formatMoney,
  formatZip,
} from '@/lib/format';
import type { CompanySettings, SaleDetail } from '@/lib/types';
import { PrintButton } from '@/components/ui/PrintButton';

export const metadata: Metadata = { title: 'DANFE' };

const NFCE_CONSULT_URL = 'https://www.homologacao.nfce.fazenda.sp.gov.br/consulta';

// O SVG e gerado no servidor pelo bwip-js a partir de dados da propria nota
// (chave numerica e URL do QR Code montada pela API), sem entrada livre.
function barcodeSvg(bcid: 'qrcode' | 'code128', text: string): string {
  return bwipjs.toSVG(
    bcid === 'qrcode'
      ? { bcid, text, scale: 3 }
      : { bcid, text, scale: 1, height: 12, includetext: false },
  );
}

function Svg({ svg, className }: { svg: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default async function DanfePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  let sale: SaleDetail;
  let company: CompanySettings;
  try {
    [sale, company] = await Promise.all([
      apiFetch<SaleDetail>(`/sales/${id}`),
      apiFetch<CompanySettings>('/company-settings'),
    ]);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const fiscal = sale.fiscalDocument;
  if (!fiscal?.accessKey || !['ISSUED', 'CANCELLED'].includes(fiscal.status)) {
    return (
      <div className="card p-6 text-sm text-slate-600">
        <p>Esta venda ainda não tem nota autorizada, então não há DANFE para imprimir.</p>
        <Link href={`/dashboard/sales/${sale.id}`} className="mt-3 inline-block text-brand-700 hover:underline">
          Voltar para a venda
        </Link>
      </div>
    );
  }

  const homologation = fiscal.environment === 2;
  const cancelled = fiscal.status === 'CANCELLED';
  const toolbar = (
    <div className="no-print mb-4 flex flex-wrap items-center gap-2">
      <Link href={`/dashboard/sales/${sale.id}`} className="btn-secondary">
        Voltar
      </Link>
      <PrintButton label="Imprimir DANFE" />
    </div>
  );
  const warnings = (
    <>
      {homologation && (
        <p className="danfe-warning">EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL</p>
      )}
      {cancelled && <p className="danfe-warning">NOTA CANCELADA</p>}
    </>
  );
  const address = `${company.street}, ${company.number} - ${company.district}, ${company.city}/${company.state} - CEP ${formatZip(company.zipCode)}`;
  const buyer = fiscal.buyerDocument ?? sale.customer?.document ?? null;

  if (fiscal.model === 'NFCE') {
    return (
      <div>
        {toolbar}
        <article className="danfe-nfce mx-auto bg-white p-3 font-mono text-[11px] leading-tight text-black">
          <header className="text-center">
            <p className="font-bold">{company.tradeName || company.legalName}</p>
            <p>CNPJ {formatDocument(company.cnpj)} IE {company.stateRegistration}</p>
            <p>{address}</p>
            <p className="mt-2 font-bold">DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</p>
          </header>
          {warnings}
          <table className="mt-2 w-full">
            <thead>
              <tr className="border-y border-dashed border-black">
                <th className="text-left">Descrição</th>
                <th className="text-right">Qtd</th>
                <th className="text-right">Unit.</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    {String(index + 1).padStart(3, '0')} {item.product.name}
                  </td>
                  <td className="text-right">
                    {item.quantity}
                    {item.product.unit}
                  </td>
                  <td className="text-right">{Number(item.unitPrice).toFixed(2)}</td>
                  <td className="text-right">{(Number(item.unitPrice) * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-2 border-t border-dashed border-black pt-1">
            <Row label="Qtd. total de itens" value={String(sale.items.length)} />
            <Row label="Valor total R$" value={Number(sale.subtotal).toFixed(2)} />
            {Number(sale.discount) > 0 && <Row label="Desconto R$" value={Number(sale.discount).toFixed(2)} />}
            <Row label="Valor a pagar R$" value={Number(sale.total).toFixed(2)} bold />
            <Row label="Forma de pagamento" value={PAYMENT_METHOD_LABELS[sale.paymentMethod]} />
          </dl>
          <section className="mt-2 border-t border-dashed border-black pt-1 text-center">
            <p>Consulte pela chave de acesso em</p>
            <p className="break-all">{NFCE_CONSULT_URL}</p>
            <p className="mt-1 font-bold">{formatAccessKey(fiscal.accessKey)}</p>
          </section>
          <section className="mt-2 border-t border-dashed border-black pt-1 text-center">
            <p>{buyer ? `CONSUMIDOR CPF/CNPJ ${formatDocument(buyer)}` : 'CONSUMIDOR NÃO IDENTIFICADO'}</p>
            <p className="mt-1">
              NFC-e nº {fiscal.number} Série {fiscal.series} {formatDateTime(sale.createdAt)}
            </p>
            <p>Protocolo de autorização: {fiscal.protocol}</p>
            <p>Data de autorização: {formatDateTime(fiscal.authorizedAt)}</p>
          </section>
          {fiscal.qrCodeUrl && (
            <Svg svg={barcodeSvg('qrcode', fiscal.qrCodeUrl)} className="danfe-qrcode mx-auto mt-2" />
          )}
          {warnings}
        </article>
      </div>
    );
  }

  const customer = sale.customer;
  return (
    <div>
      {toolbar}
      <article className="danfe-nfe mx-auto space-y-2 bg-white p-4 text-[10px] leading-tight text-black">
        <div className="danfe-box flex justify-between gap-2">
          <p>
            RECEBEMOS DE {company.legalName} OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO
          </p>
          <p className="shrink-0 text-center font-bold">
            NF-e
            <br />
            Nº {fiscal.number}
            <br />
            Série {fiscal.series}
          </p>
        </div>

        <div className="grid grid-cols-[2fr_1fr_2fr] gap-2">
          <div className="danfe-box">
            <p className="text-sm font-bold">{company.legalName}</p>
            <p>{address}</p>
            {company.phone && <p>Fone {company.phone}</p>}
          </div>
          <div className="danfe-box text-center">
            <p className="text-sm font-bold">DANFE</p>
            <p>Documento Auxiliar da Nota Fiscal Eletrônica</p>
            <p className="mt-1">1 - SAÍDA</p>
            <p className="mt-1 font-bold">
              Nº {fiscal.number} · Série {fiscal.series}
            </p>
          </div>
          <div className="danfe-box">
            <Svg svg={barcodeSvg('code128', fiscal.accessKey)} className="danfe-code128" />
            <Field label="Chave de acesso" value={formatAccessKey(fiscal.accessKey)} />
            <p className="mt-1">
              Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da
              SEFAZ autorizadora
            </p>
          </div>
        </div>

        <div className="danfe-box grid grid-cols-2 gap-2">
          <Field label="Natureza da operação" value="VENDA DE MERCADORIA" />
          <Field
            label="Protocolo de autorização de uso"
            value={`${fiscal.protocol} - ${formatDateTime(fiscal.authorizedAt)}`}
          />
          <Field label="Inscrição estadual" value={company.stateRegistration} />
          <Field label="CNPJ" value={formatDocument(company.cnpj)} />
        </div>

        {warnings}

        <h3 className="font-bold">DESTINATÁRIO / REMETENTE</h3>
        <div className="danfe-box grid grid-cols-3 gap-2">
          <Field label="Nome / razão social" value={customer?.name ?? '-'} />
          <Field label="CNPJ / CPF" value={formatDocument(buyer)} />
          <Field label="Data da emissão" value={formatDateTime(sale.createdAt)} />
          <Field
            label="Endereço"
            value={customer?.street ? `${customer.street}, ${customer.number ?? 'S/N'} - ${customer.district ?? ''}` : '-'}
          />
          <Field label="Município / UF" value={customer?.city ? `${customer.city}/${customer.state}` : '-'} />
          <Field label="CEP" value={formatZip(customer?.zipCode)} />
        </div>

        <h3 className="font-bold">CÁLCULO DO IMPOSTO</h3>
        <div className="danfe-box grid grid-cols-4 gap-2">
          <Field label="Base de cálculo do ICMS" value="0,00" />
          <Field label="Valor do ICMS" value="0,00" />
          <Field label="Valor total dos produtos" value={formatMoney(sale.subtotal)} />
          <Field label="Desconto" value={formatMoney(sale.discount)} />
          <Field label="Frete" value="0,00" />
          <Field label="Outras despesas" value="0,00" />
          <Field label="Pagamento" value={PAYMENT_METHOD_LABELS[sale.paymentMethod]} />
          <Field label="Valor total da nota" value={formatMoney(sale.total)} />
        </div>

        <h3 className="font-bold">DADOS DOS PRODUTOS / SERVIÇOS</h3>
        <table className="danfe-box w-full">
          <thead>
            <tr className="border-b border-black text-left">
              <th>Código</th>
              <th>Descrição</th>
              <th>NCM</th>
              <th>CSOSN</th>
              <th>CFOP</th>
              <th>Un.</th>
              <th className="text-right">Qtd.</th>
              <th className="text-right">V. unit.</th>
              <th className="text-right">V. total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id}>
                <td>{item.product.sku}</td>
                <td>{item.product.name}</td>
                <td>{item.product.ncm ?? '-'}</td>
                <td>{item.product.csosn}</td>
                <td>{item.product.cfop}</td>
                <td>{item.product.unit}</td>
                <td className="text-right">{item.quantity}</td>
                <td className="text-right">{Number(item.unitPrice).toFixed(2)}</td>
                <td className="text-right">{(Number(item.unitPrice) * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="font-bold">DADOS ADICIONAIS</h3>
        <div className="danfe-box min-h-12">
          <p>Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI.</p>
          {sale.notes && <p>{sale.notes}</p>}
        </div>
      </article>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[8px] uppercase text-slate-600">{label}</p>
      <p className="font-medium">{value || '-'}</p>
    </div>
  );
}
