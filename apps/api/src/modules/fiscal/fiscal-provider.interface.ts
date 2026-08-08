// Abstracao sobre o provedor de emissao fiscal (NF-e). O restante do
// sistema so conhece esta interface; trocar de provedor (Focus NFe,
// PlugNotas, NFe.io) ou de modo (sandbox/producao) e uma questao de
// implementar um novo adapter, sem tocar em SalesService ou no worker.
export interface FiscalEmissionItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface FiscalEmissionInput {
  saleId: string;
  total: number;
  items: FiscalEmissionItem[];
}

export interface FiscalEmissionResult {
  externalId: string;
  xmlUrl?: string;
  pdfUrl?: string;
}

export interface FiscalProvider {
  emit(input: FiscalEmissionInput): Promise<FiscalEmissionResult>;
}
