import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
import type { Customer, PaginatedResponse } from '@/lib/types';
import { PartnerList } from '@/components/partners/PartnerList';

export const metadata: Metadata = { title: 'Clientes' };

interface SearchParams {
  search?: string;
  active?: string;
  page?: string;
}

export default async function CustomersPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const page = Number(searchParams.page ?? '1') || 1;
  const active = searchParams.active ?? 'true';

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (searchParams.search) params.set('search', searchParams.search);
  if (active) params.set('active', active);

  const data = await apiFetch<PaginatedResponse<Customer>>(`/customers?${params.toString()}`);

  return (
    <PartnerList
      title="Clientes"
      resource="customers"
      newLabel="Novo cliente"
      data={data}
      page={page}
      searchParams={{ search: searchParams.search, active }}
    />
  );
}
