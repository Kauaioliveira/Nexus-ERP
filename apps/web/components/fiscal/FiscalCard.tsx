import Link from 'next/link';
import { Download, FileText, Loader2 } from 'lucide-react';
import { retryFiscalAction } from '@/actions/sales';
import { FISCAL_MODEL_LABELS, formatAccessKey, formatDateTime } from '@/lib/format';
import type { FiscalDocument } from '@/lib/types';
import { FiscalStatusBadge } from '@/components/ui/StatusBadges';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { AutoRefresh } from './AutoRefresh';

// Dica de correcao para as rejeicoes mais comuns da SEFAZ.
const REJECTION_HINTS: Record<number, string> = {
  778: 'Preencha o NCM (8 dígitos) do produto indicado e reenvie.',
  611: 'O código de barras do produto não é um GTIN válido. Corrija ou apague o código e reenvie.',
  237: 'O CPF informado é inválido.',
  208: 'O CNPJ do cliente é inválido.',
  207: 'O CNPJ da empresa é inválido. Corrija em Empresa e fiscal.',
  209: 'Preencha a inscrição estadual em Empresa e fiscal.',
  108: 'A SEFAZ simulada está fora do ar (opção em Empresa e fiscal). A nota será reenviada automaticamente algumas vezes; depois, use Reenviar.',
};

export function FiscalCard({ saleId, fiscal, isAdmin }: { saleId: string; fiscal: FiscalDocument; isAdmin: boolean }) {
  const label = FISCAL_MODEL_LABELS[fiscal.model];
  const pending = fiscal.status === 'QUEUED' || fiscal.status === 'PROCESSING';
  const canRetry = ['FAILED', 'QUEUED', 'REJECTED'].includes(fiscal.status);
  const hint = fiscal.statusCode ? REJECTION_HINTS[fiscal.statusCode] : undefined;
  const hasNumber = fiscal.number && fiscal.series;

  return (
    <div className="card no-print space-y-3 p-5 text-sm">
      <AutoRefresh active={pending} />
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">
          {label}
          {hasNumber && ` nº ${fiscal.number} · série ${fiscal.series}`}
        </h2>
        <FiscalStatusBadge status={fiscal.status} model={fiscal.model} />
      </div>

      {pending && (
        <p className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Enviando para a SEFAZ...
        </p>
      )}

      {fiscal.accessKey && (
        <div>
          <p className="text-xs text-slate-500">Chave de acesso</p>
          <p className="break-all font-mono text-xs text-slate-900">{formatAccessKey(fiscal.accessKey)}</p>
        </div>
      )}

      {fiscal.protocol && (
        <p className="text-slate-600">
          Protocolo {fiscal.protocol} · {formatDateTime(fiscal.authorizedAt)}
        </p>
      )}

      {fiscal.statusCode && fiscal.status !== 'ISSUED' && (
        <div
          className={`rounded-lg px-3 py-2 ${fiscal.status === 'CANCELLED' ? 'bg-slate-50 text-slate-700' : 'bg-red-50 text-red-800'}`}
        >
          <p className="font-medium">
            {fiscal.statusCode} - {fiscal.statusMessage}
          </p>
          {hint && fiscal.status !== 'CANCELLED' && <p className="mt-1">{hint}</p>}
          {fiscal.status === 'CANCELLED' && fiscal.cancelProtocol && (
            <p className="mt-1">
              Protocolo do cancelamento {fiscal.cancelProtocol} · {formatDateTime(fiscal.cancelledAt)}
            </p>
          )}
        </div>
      )}

      {fiscal.status === 'NOT_REQUESTED' && fiscal.errorMessage && <p className="text-slate-600">{fiscal.errorMessage}</p>}

      <p className="text-xs text-slate-500">
        {fiscal.environment === 2 ? 'Homologação, sem valor fiscal.' : 'Produção.'} SEFAZ{' '}
        {fiscal.provider === 'sandbox' ? 'simulada' : fiscal.provider}.
      </p>

      <div className="flex flex-wrap gap-2">
        {(fiscal.status === 'ISSUED' || fiscal.status === 'CANCELLED') && (
          <>
            <Link href={`/dashboard/sales/${saleId}/danfe`} className="btn-secondary btn-sm">
              <FileText className="h-4 w-4" aria-hidden /> {fiscal.model === 'NFCE' ? 'DANFE NFC-e' : 'DANFE'}
            </Link>
            <a href={`/dashboard/sales/${saleId}/xml`} className="btn-secondary btn-sm">
              <Download className="h-4 w-4" aria-hidden /> XML
            </a>
          </>
        )}
        {fiscal.status === 'CANCELLED' && (
          <a href={`/dashboard/sales/${saleId}/xml?tipo=cancelamento`} className="btn-secondary btn-sm">
            <Download className="h-4 w-4" aria-hidden /> XML do cancelamento
          </a>
        )}
        {isAdmin && canRetry && (
          <form action={retryFiscalAction.bind(null, saleId)}>
            <SubmitButton label={`Reenviar ${label}`} pendingLabel="Enviando..." variant="secondary" size="sm" />
          </form>
        )}
      </div>
    </div>
  );
}
