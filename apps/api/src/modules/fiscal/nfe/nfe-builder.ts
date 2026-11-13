import { CompanySettings, Customer, PaymentMethod, Product, Sale, SaleItem } from '@prisma/client';
import { isRestrictedGtin, isValidGtin, onlyDigits } from './brazil';
import { NfeData, NfeItem, NfeModel, NfeRecipient } from './nfe-types';

export type SaleForInvoice = Sale & {
  items: (SaleItem & { product: Product })[];
  customer: Customer | null;
};

export const PAYMENT_CODES: Record<PaymentMethod, string> = {
  DINHEIRO: '01',
  CARTAO_CREDITO: '03',
  CARTAO_DEBITO: '04',
  A_PRAZO: '05', // credito loja (crediario)
  BOLETO: '15',
  PIX: '17',
};

const toCents = (value: unknown) => Math.round(Number(value) * 100);

// Rateia o desconto da venda entre os itens, proporcional ao valor de
// cada um. A diferenca de arredondamento vai para o ultimo item, para que
// a soma dos vDesc bata exatamente com o desconto total (regra da SEFAZ).
export function distributeDiscount(itemCents: number[], discountCents: number): number[] {
  const totalCents = itemCents.reduce((sum, value) => sum + value, 0);
  if (discountCents <= 0 || totalCents === 0) return itemCents.map(() => 0);
  const shares = itemCents.map((value) => Math.floor((value * discountCents) / totalCents));
  const assigned = shares.reduce((sum, value) => sum + value, 0);
  shares[shares.length - 1] += discountCents - assigned;
  return shares;
}

// Codigo de barras so vai no cEAN se for um GTIN valido de uso publico;
// codigos internos viram "SEM GTIN", como manda a legislacao.
export function gtinForInvoice(barcode: string | null): string | null {
  if (!barcode) return null;
  return isValidGtin(barcode) && !isRestrictedGtin(barcode) ? barcode : null;
}

export function customerRecipient(customer: Customer): NfeRecipient | null {
  if (!customer.document) return null;
  const hasAddress = customer.street || customer.cityCode;
  return {
    document: onlyDigits(customer.document),
    name: customer.name,
    email: customer.email,
    address: hasAddress
      ? {
          street: customer.street ?? '',
          number: customer.number ?? '',
          district: customer.district ?? '',
          cityCode: customer.cityCode ?? '',
          city: customer.city ?? '',
          state: customer.state ?? '',
          zipCode: customer.zipCode ?? '',
          phone: customer.phone,
        }
      : null,
  };
}

export interface BuildNfeInput {
  sale: SaleForInvoice;
  settings: CompanySettings;
  model: NfeModel;
  series: number;
  number: number;
  randomCode: number;
  issuedAt: Date;
  accessKey: string;
  buyerDocument?: string | null;
}

export function buildNfeData(input: BuildNfeInput): NfeData {
  const { sale, settings } = input;
  const grossCents = sale.items.map((item) => toCents(item.unitPrice) * item.quantity);
  const discounts = distributeDiscount(grossCents, toCents(sale.discount));

  const items: NfeItem[] = sale.items.map((item, index) => ({
    code: item.product.sku,
    gtin: gtinForInvoice(item.product.barcode),
    description: item.product.name,
    ncm: item.product.ncm,
    cest: item.product.cest,
    cfop: item.product.cfop,
    unit: item.product.unit,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    grossTotal: grossCents[index] / 100,
    discount: discounts[index] / 100,
    origin: item.product.origin,
    csosn: item.product.csosn,
  }));

  let recipient: NfeRecipient | null = null;
  if (input.model === 55) {
    recipient = sale.customer ? customerRecipient(sale.customer) : null;
  } else if (input.buyerDocument) {
    // NFC-e: "CPF na nota" - so o documento, sem endereco.
    recipient = { document: onlyDigits(input.buyerDocument), name: sale.customer?.name ?? null };
  }

  const total = Number(sale.total);
  const deferred =
    sale.paymentMethod === PaymentMethod.A_PRAZO || sale.paymentMethod === PaymentMethod.BOLETO;

  return {
    model: input.model,
    environment: settings.environment,
    series: input.series,
    number: input.number,
    randomCode: input.randomCode,
    issuedAt: input.issuedAt,
    emissionType: 1,
    accessKey: input.accessKey,
    emitter: {
      cnpj: settings.cnpj,
      legalName: settings.legalName,
      tradeName: settings.tradeName,
      stateRegistration: settings.stateRegistration,
      taxRegime: settings.taxRegime,
      address: {
        street: settings.street,
        number: settings.number,
        district: settings.district,
        cityCode: settings.cityCode,
        city: settings.city,
        state: settings.state,
        zipCode: settings.zipCode,
        phone: settings.phone,
      },
    },
    recipient,
    items,
    totals: {
      products: grossCents.reduce((sum, value) => sum + value, 0) / 100,
      discount: Number(sale.discount),
      total,
    },
    payments: [{ method: PAYMENT_CODES[sale.paymentMethod], amount: total, deferred }],
    change: 0,
    additionalInfo: `Venda #${sale.number}. Documento emitido por ME ou EPP optante pelo Simples Nacional.`,
  };
}
