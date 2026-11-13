import { createHash } from 'node:crypto';

// QR Code da NFC-e, versao 2 (emissao online), conforme a NT 2015.002:
//   <url>?p=<chave>|2|<tpAmb>|<idCSC sem zeros a esquerda>|<hash>
// onde hash = SHA-1 em hexadecimal maiusculo de
//   <chave>|2|<tpAmb>|<idCSC><CSC>

// Enderecos de consulta da SEFAZ-SP em homologacao. Para outras UFs a
// SEFAZ simulada usa os mesmos, ja que a nota nao existe na SEFAZ real.
export const NFCE_QR_URL = 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode';
export const NFCE_CONSULT_URL = 'https://www.homologacao.nfce.fazenda.sp.gov.br/consulta';

export function buildNfceQrCodeUrl(
  accessKey: string,
  environment: number,
  cscId: string,
  cscToken: string,
): string {
  const idToken = String(Number(cscId));
  const payload = `${accessKey}|2|${environment}|${idToken}`;
  const hash = createHash('sha1')
    .update(payload + cscToken)
    .digest('hex')
    .toUpperCase();
  return `${NFCE_QR_URL}?p=${payload}|${hash}`;
}
