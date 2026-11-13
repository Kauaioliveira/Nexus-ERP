import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { isRestrictedGtin, isValidGtin } from '../fiscal/nfe/brazil';

export interface BarcodeSuggestion {
  name: string;
  brand?: string;
  quantity?: string;
  imageUrl?: string;
  ncm?: string;
  cest?: string;
  source: 'cosmos' | OpenFactsSource;
}

// Bases abertas da mesma familia (mesma API): alimentos, cosmeticos e
// higiene, produtos em geral (limpeza, utilidades, eletronicos) e pet.
// Consultadas em paralelo; vale a primeira da lista que conhecer o codigo.
const OPEN_FACTS_HOSTS = {
  openfoodfacts: 'world.openfoodfacts.org',
  openbeautyfacts: 'world.openbeautyfacts.org',
  openproductsfacts: 'world.openproductsfacts.org',
  openpetfoodfacts: 'world.openpetfoodfacts.org',
} as const;
type OpenFactsSource = keyof typeof OPEN_FACTS_HOSTS;

const PRODUCT_SELECT = {
  id: true,
  sku: true,
  barcode: true,
  name: true,
  unit: true,
  salePrice: true,
  costPrice: true,
  currentStock: true,
  active: true,
  ncm: true,
} as const;

// Identifica um produto pelo codigo lido no leitor/camera: primeiro no
// cadastro da loja; se nao existir e for um GTIN valido, consulta uma base
// externa para sugerir os dados do cadastro:
// - Cosmos (Bluesoft), base brasileira com NCM, quando COSMOS_TOKEN existe;
// - Open Food Facts, base aberta e gratuita (alimentos, bebidas, higiene).
@Injectable()
export class BarcodeLookupService {
  private readonly logger = new Logger(BarcodeLookupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async lookup(rawCode: string) {
    const code = rawCode.trim();
    const validGtin = isValidGtin(code);
    const restricted = validGtin && isRestrictedGtin(code);

    const product = await this.prisma.product.findFirst({
      where: { OR: [{ barcode: code }, { sku: { equals: code, mode: 'insensitive' } }] },
      select: PRODUCT_SELECT,
      orderBy: { active: 'desc' },
    });

    const suggestion =
      !product && validGtin && !restricted ? await this.fetchSuggestion(code) : null;
    return { code, validGtin, restricted, product, suggestion };
  }

  private async fetchSuggestion(code: string): Promise<BarcodeSuggestion | null> {
    if (this.config.get<string>('BARCODE_LOOKUP') === 'off') return null;
    const cosmosToken = this.config.get<string>('COSMOS_TOKEN');
    if (cosmosToken) {
      const fromCosmos = await this.fetchCosmos(code, cosmosToken);
      if (fromCosmos) return fromCosmos;
    }
    const results = await Promise.all(
      (Object.keys(OPEN_FACTS_HOSTS) as OpenFactsSource[]).map((source) =>
        this.fetchOpenFacts(code, source),
      ),
    );
    return results.find((result) => result !== null) ?? null;
  }

  private async fetchCosmos(code: string, token: string): Promise<BarcodeSuggestion | null> {
    try {
      const response = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${code}.json`, {
        headers: { 'X-Cosmos-Token': token, 'User-Agent': 'Cosmos-API-Request' },
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as {
        description?: string;
        brand?: { name?: string };
        ncm?: { code?: string };
        cest?: { code?: string } | null;
        thumbnail?: string;
      };
      const name = body.description?.trim();
      if (!name) return null;
      const ncm = body.ncm?.code?.replace(/\D/g, '');
      const cest = body.cest?.code?.replace(/\D/g, '');
      return {
        name,
        brand: body.brand?.name?.trim() || undefined,
        ncm: ncm && ncm.length === 8 ? ncm : undefined,
        cest: cest && cest.length === 7 ? cest : undefined,
        imageUrl: body.thumbnail,
        source: 'cosmos',
      };
    } catch (error) {
      this.logger.warn(`Consulta do codigo ${code} no Cosmos falhou: ${String(error)}`);
      return null;
    }
  }

  private async fetchOpenFacts(
    code: string,
    source: OpenFactsSource,
  ): Promise<BarcodeSuggestion | null> {
    const url = `https://${OPEN_FACTS_HOSTS[source]}/api/v2/product/${code}.json?fields=product_name,product_name_pt,brands,quantity,image_front_small_url`;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'NexusERP/1.0 (https://github.com/Kauaioliveira/Nexus-ERP)' },
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as {
        status?: number;
        product?: {
          product_name?: string;
          product_name_pt?: string;
          brands?: string;
          quantity?: string;
          image_front_small_url?: string;
        };
      };
      const found = body.product;
      const name = (found?.product_name_pt || found?.product_name || '').trim();
      if (body.status !== 1 || !name) return null;
      return {
        name,
        brand: found?.brands?.split(',')[0]?.trim() || undefined,
        quantity: found?.quantity?.trim() || undefined,
        imageUrl: found?.image_front_small_url,
        source,
      };
    } catch (error) {
      // Sem internet ou base fora do ar: o cadastro segue manual.
      this.logger.warn(
        `Consulta do codigo ${code} em ${OPEN_FACTS_HOSTS[source]} falhou: ${String(error)}`,
      );
      return null;
    }
  }
}
