import Link from 'next/link';

// Paginacao por links (funciona sem JavaScript e mantem os filtros da URL).
export function Pagination({
  page,
  total,
  pageSize,
  pathname,
  query,
}: {
  page: number;
  total: number;
  pageSize: number;
  pathname: string;
  query: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    params.set('page', String(target));
    return `${pathname}?${params.toString()}`;
  };

  return (
    <nav className="no-print flex items-center justify-between text-sm" aria-label="Paginação">
      <p className="text-slate-500">
        Página {page} de {totalPages} · {total} registro(s)
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="btn-secondary btn-sm">
            Anterior
          </Link>
        ) : (
          <span className="btn-secondary btn-sm pointer-events-none opacity-50">Anterior</span>
        )}
        {page < totalPages ? (
          <Link href={href(page + 1)} className="btn-secondary btn-sm">
            Próxima
          </Link>
        ) : (
          <span className="btn-secondary btn-sm pointer-events-none opacity-50">Próxima</span>
        )}
      </div>
    </nav>
  );
}
