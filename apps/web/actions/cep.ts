'use server';

export interface CepAddress {
  zipCode: string;
  street: string;
  district: string;
  city: string;
  cityCode: string;
  state: string;
}

// Consulta o CEP no ViaCEP (gratuito, sem chave). Traz o codigo IBGE do
// municipio, exigido na NF-e. Sem internet, devolve null e o usuario
// preenche o endereco manualmente.
export async function lookupCepAction(rawCep: string): Promise<CepAddress | null> {
  const cep = rawCep.replace(/\D/g, '');
  if (cep.length !== 8) return null;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(4000),
      cache: 'force-cache',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      ibge?: string;
      uf?: string;
    };
    if (data.erro) return null;
    return {
      zipCode: cep,
      street: data.logradouro ?? '',
      district: data.bairro ?? '',
      city: data.localidade ?? '',
      cityCode: data.ibge ?? '',
      state: data.uf ?? '',
    };
  } catch {
    return null;
  }
}
