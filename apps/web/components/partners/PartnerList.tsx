import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import type { PaginatedResponse } from '@/lib/types';

interface PartnerRow {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
}

// Lista de clientes ou fornecedores (mesma estrutura de tela).
export function PartnerList({
  title,
  resource,
  newLabel,
  data,
  page,
  searchParams,
}: {
  title: string;
  resource: 'customers' | 'suppliers';
  newLabel: string;
  data: PaginatedResponse<PartnerRow>;
  page: number;
  searchParams: { search?: string; active?: string };
}) {
  const basePath = `/dashboard/${resource}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={`${data.total} cadastro(s)`}
        actions={
          <Link href={`${basePath}/new`} className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            {newLabel}
          </Link>
        }
      />

      <form method="GET" className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[240px] flex-1">
          <label htmlFor="search" className="label">
            Buscar
          </label>
          <input
            id="search"
            name="search"
            type="search"
            placeholder="Nome, documento, e-mail ou telefone"
            defaultValue={searchParams.search}
            className="input mt-1"
          />
        </div>
        <div>
          <label htmlFor="active" className="label">
            Situação
          </label>
          <select id="active" name="active" defaultValue={searchParams.active ?? 'true'} className="input mt-1">
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
            <option value="">Todos</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="table-head">
            <tr>
              <th scope="col" className="px-4 py-3">Nome</th>
              <th scope="col" className="px-4 py-3">Documento</th>
              <th scope="col" className="px-4 py-3">Contato</th>
              <th scope="col" className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`${basePath}/${row.id}`} className="font-medium text-brand-700 hover:underline">
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.document ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">
                  {[row.phone, row.email].filter(Boolean).join(' · ') || '-'}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? 'Ativo' : 'Inativo'}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.items.length === 0 && <EmptyState title="Nenhum cadastro encontrado." />}
      </div>

      <Pagination
        page={page}
        total={data.total}
        pageSize={data.pageSize}
        pathname={basePath}
        query={{ search: searchParams.search, active: searchParams.active }}
      />
    </div>
  );
}
