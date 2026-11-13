import { onlyDigits, UF_CODES } from './brazil';
import {
  HOMOLOGATION_FIRST_ITEM,
  HOMOLOGATION_RECIPIENT_NAME,
  NfeAddress,
  NfeData,
  NfeItem,
  SefazResult,
} from './nfe-types';

// Gera o XML no leiaute 4.00 da NF-e/NFC-e (Manual de Orientacao do
// Contribuinte). Fica de fora apenas a assinatura digital (XMLDSig com
// certificado A1), que so faz sentido com um certificado real.

const NS = 'http://www.portalfiscal.inf.br/nfe';
export const NFE_VERSION = '4.00';
export const APP_VERSION = 'NexusERP-1.0';

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const dec = (value: number, places = 2) => value.toFixed(places);

function tag(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

// "2026-11-12T20:15:00-03:00" - horario de Brasilia, como a SEFAZ espera.
export function formatNfeDate(date: Date): string {
  const local = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 19) + '-03:00';
}

function address(prefix: 'enderEmit' | 'enderDest', addr: NfeAddress): string {
  return (
    `<${prefix}>` +
    tag('xLgr', addr.street) +
    tag('nro', addr.number) +
    tag('xBairro', addr.district) +
    tag('cMun', addr.cityCode) +
    tag('xMun', addr.city) +
    tag('UF', addr.state) +
    tag('CEP', onlyDigits(addr.zipCode)) +
    tag('cPais', '1058') +
    tag('xPais', 'BRASIL') +
    tag('fone', onlyDigits(addr.phone ?? '') || null) +
    `</${prefix}>`
  );
}

function icms(item: NfeItem): string {
  // CSOSN 102/103/300/400 usam o grupo ICMSSN102; 500 (ICMS cobrado
  // anteriormente por ST) usa o ICMSSN500.
  const group = item.csosn === '500' ? 'ICMSSN500' : 'ICMSSN102';
  return `<ICMS><${group}>${tag('orig', item.origin)}${tag('CSOSN', item.csosn)}</${group}></ICMS>`;
}

const PIS_COFINS_ZERO = (name: 'PIS' | 'COFINS') =>
  `<${name}><${name}Outr><CST>99</CST><vBC>0.00</vBC><p${name}>0.0000</p${name}><v${name}>0.00</v${name}></${name}Outr></${name}>`;

function detail(item: NfeItem, index: number, data: NfeData): string {
  const homologation = data.environment === 2;
  const description = homologation && index === 0 ? HOMOLOGATION_FIRST_ITEM : item.description;
  const gtin = item.gtin || 'SEM GTIN';

  return (
    `<det nItem="${index + 1}"><prod>` +
    tag('cProd', item.code) +
    tag('cEAN', gtin) +
    tag('xProd', description.slice(0, 120)) +
    tag('NCM', item.ncm ?? '') +
    tag('CEST', item.cest) +
    tag('CFOP', item.cfop) +
    tag('uCom', item.unit) +
    tag('qCom', dec(item.quantity, 4)) +
    tag('vUnCom', dec(item.unitPrice, 4)) +
    tag('vProd', dec(item.grossTotal)) +
    tag('cEANTrib', gtin) +
    tag('uTrib', item.unit) +
    tag('qTrib', dec(item.quantity, 4)) +
    tag('vUnTrib', dec(item.unitPrice, 4)) +
    (item.discount > 0 ? tag('vDesc', dec(item.discount)) : '') +
    tag('indTot', 1) +
    `</prod><imposto>${icms(item)}${PIS_COFINS_ZERO('PIS')}${PIS_COFINS_ZERO('COFINS')}</imposto></det>`
  );
}

const CARD_METHODS = ['03', '04', '17'];

function payments(data: NfeData): string {
  const details = data.payments
    .map(
      (payment) =>
        '<detPag>' +
        tag('indPag', payment.deferred ? 1 : 0) +
        tag('tPag', payment.method) +
        tag('vPag', dec(payment.amount)) +
        // Pagamento eletronico sem integracao com o TEF/maquininha.
        (CARD_METHODS.includes(payment.method) ? '<card><tpIntegra>2</tpIntegra></card>' : '') +
        '</detPag>',
    )
    .join('');
  return `<pag>${details}${data.change > 0 ? tag('vTroco', dec(data.change)) : ''}</pag>`;
}

function recipient(data: NfeData): string {
  const dest = data.recipient;
  if (!dest) return '';
  const doc = onlyDigits(dest.document);
  const homologation = data.environment === 2;
  const name = homologation ? HOMOLOGATION_RECIPIENT_NAME : dest.name;

  return (
    '<dest>' +
    (doc.length === 14 ? tag('CNPJ', doc) : tag('CPF', doc)) +
    tag('xNome', name) +
    (dest.address ? address('enderDest', dest.address) : '') +
    tag('indIEDest', 9) + // nao contribuinte
    tag('email', dest.email) +
    '</dest>'
  );
}

export function buildNfeXml(data: NfeData): string {
  const nfce = data.model === 65;
  const emitter = data.emitter;
  const destUf = data.recipient?.address?.state;
  const interstate = !nfce && destUf && destUf !== emitter.address.state;

  const ide =
    '<ide>' +
    tag('cUF', UF_CODES[emitter.address.state]) +
    tag('cNF', String(data.randomCode).padStart(8, '0')) +
    tag('natOp', 'VENDA DE MERCADORIA') +
    tag('mod', data.model) +
    tag('serie', data.series) +
    tag('nNF', data.number) +
    tag('dhEmi', formatNfeDate(data.issuedAt)) +
    (nfce ? '' : tag('dhSaiEnt', formatNfeDate(data.issuedAt))) +
    tag('tpNF', 1) +
    tag('idDest', interstate ? 2 : 1) +
    tag('cMunFG', emitter.address.cityCode) +
    tag('tpImp', nfce ? 4 : 1) +
    tag('tpEmis', data.emissionType) +
    tag('cDV', data.accessKey.slice(-1)) +
    tag('tpAmb', data.environment) +
    tag('finNFe', 1) +
    tag('indFinal', 1) +
    tag('indPres', 1) +
    tag('indIntermed', 0) +
    tag('procEmi', 0) +
    tag('verProc', APP_VERSION) +
    '</ide>';

  const emit =
    '<emit>' +
    tag('CNPJ', onlyDigits(emitter.cnpj)) +
    tag('xNome', emitter.legalName) +
    tag('xFant', emitter.tradeName) +
    address('enderEmit', emitter.address) +
    tag('IE', onlyDigits(emitter.stateRegistration)) +
    tag('CRT', emitter.taxRegime) +
    '</emit>';

  const t = data.totals;
  const total =
    '<total><ICMSTot>' +
    ['vBC', 'vICMS', 'vICMSDeson', 'vFCP', 'vBCST', 'vST', 'vFCPST', 'vFCPSTRet']
      .map((name) => tag(name, '0.00'))
      .join('') +
    tag('vProd', dec(t.products)) +
    ['vFrete', 'vSeg'].map((name) => tag(name, '0.00')).join('') +
    tag('vDesc', dec(t.discount)) +
    ['vII', 'vIPI', 'vIPIDevol', 'vPIS', 'vCOFINS', 'vOutro']
      .map((name) => tag(name, '0.00'))
      .join('') +
    tag('vNF', dec(t.total)) +
    '</ICMSTot></total>';

  const infAdic = data.additionalInfo
    ? `<infAdic>${tag('infCpl', data.additionalInfo)}</infAdic>`
    : '';

  const infNFe =
    `<infNFe Id="NFe${data.accessKey}" versao="${NFE_VERSION}">` +
    ide +
    emit +
    recipient(data) +
    data.items.map((item, index) => detail(item, index, data)).join('') +
    total +
    '<transp><modFrete>9</modFrete></transp>' +
    payments(data) +
    infAdic +
    '</infNFe>';

  const supl =
    nfce && data.qrCode
      ? `<infNFeSupl><qrCode><![CDATA[${data.qrCode.url}]]></qrCode>${tag('urlChave', data.qrCode.consultUrl)}</infNFeSupl>`
      : '';

  return `<NFe xmlns="${NS}">${infNFe}${supl}</NFe>`;
}

// Envelope com o protocolo de autorizacao, como o XML que se guarda por 5 anos.
export function wrapAuthorizedXml(
  nfeXml: string,
  accessKey: string,
  environment: number,
  result: SefazResult,
): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="${NFE_VERSION}" xmlns="${NS}">` +
    nfeXml +
    `<protNFe versao="${NFE_VERSION}"><infProt>` +
    tag('tpAmb', environment) +
    tag('verAplic', 'SEFAZ-SIMULADA') +
    tag('chNFe', accessKey) +
    tag('dhRecbto', formatNfeDate(result.receivedAt)) +
    tag('nProt', result.protocol) +
    tag('cStat', result.statusCode) +
    tag('xMotivo', result.statusMessage) +
    '</infProt></protNFe></nfeProc>'
  );
}

export interface CancelEventInput {
  accessKey: string;
  cnpj: string;
  environment: number;
  authorizationProtocol: string;
  reason: string;
  requestedAt: Date;
}

export function buildCancelEventXml(input: CancelEventInput, result: SefazResult): string {
  const ufCode = input.accessKey.slice(0, 2);
  const eventId = `ID110111${input.accessKey}01`;
  return (
    `<?xml version="1.0" encoding="UTF-8"?><procEventoNFe versao="1.00" xmlns="${NS}">` +
    `<evento versao="1.00"><infEvento Id="${eventId}">` +
    tag('cOrgao', ufCode) +
    tag('tpAmb', input.environment) +
    tag('CNPJ', onlyDigits(input.cnpj)) +
    tag('chNFe', input.accessKey) +
    tag('dhEvento', formatNfeDate(input.requestedAt)) +
    tag('tpEvento', '110111') +
    tag('nSeqEvento', 1) +
    tag('verEvento', '1.00') +
    '<detEvento versao="1.00">' +
    tag('descEvento', 'Cancelamento') +
    tag('nProt', input.authorizationProtocol) +
    tag('xJust', input.reason) +
    '</detEvento></infEvento></evento>' +
    '<retEvento versao="1.00"><infEvento>' +
    tag('tpAmb', input.environment) +
    tag('verAplic', 'SEFAZ-SIMULADA') +
    tag('cOrgao', ufCode) +
    tag('cStat', result.statusCode) +
    tag('xMotivo', result.statusMessage) +
    tag('chNFe', input.accessKey) +
    tag('tpEvento', '110111') +
    tag('nSeqEvento', 1) +
    tag('dhRegEvento', formatNfeDate(result.receivedAt)) +
    tag('nProt', result.protocol) +
    '</infEvento></retEvento></procEventoNFe>'
  );
}
