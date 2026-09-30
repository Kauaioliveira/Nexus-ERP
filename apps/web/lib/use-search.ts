'use client';

import { useEffect, useState } from 'react';

// Busca com atraso (debounce) para nao chamar a API a cada tecla. Os
// resultados ficam associados ao termo que os gerou: se o termo mudou (ou
// ficou vazio), a lista some sem precisar de setState dentro do efeito.
export function useSearch<T>(search: (term: string) => Promise<T[]>, term: string, delay = 250) {
  const [state, setState] = useState<{ term: string; results: T[] }>({ term: '', results: [] });
  const query = term.trim();

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      search(query)
        .catch(() => [] as T[])
        .then((results) => {
          if (!cancelled) setState({ term: query, results });
        });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, query, delay]);

  const ready = query.length > 0 && state.term === query;
  return { results: ready ? state.results : [], loading: query.length > 0 && !ready };
}
