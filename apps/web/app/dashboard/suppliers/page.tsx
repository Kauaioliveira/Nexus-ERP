import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
import type { Supplier, PaginatedResponse } from '@/lib/types';
import { PartnerList } from '@/components/partners/PartnerList';

export const metadata: Metadata = { title: 'Fornecedores' };

interface SearchParams {
  search?: string;
  active?: string;
  page?: string;
}

export default async function SuppliersPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const page = Number(searchParams.page ?? '1') || 1;
  const active = searchParams.active ?? 'true';

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (searchParams.search) params.set('search', searchParams.search);
  if (active) params.set('active', active);

  const data = await apiFetch<PaginatedResponse<Supplier>>(`/suppliers?${params.toString()}`);

  return (
    <PartnerList
      title="Fornecedores"
      resource="suppliers"
      newLabel="Novo fornecedor"
      data={data}
      page={page}
      searchParams={{ search: searchParams.search, active }}
    />
  );
}
