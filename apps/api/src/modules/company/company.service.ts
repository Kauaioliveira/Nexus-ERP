import { Injectable } from '@nestjs/common';
import { CompanySettings, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { onlyDigits } from '../fiscal/nfe/brazil';
import { DEFAULT_COMPANY_SETTINGS } from './company-defaults';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  // Linha unica, criada com os dados ficticios na primeira leitura.
  async get(db: Db = this.prisma): Promise<CompanySettings> {
    return db.companySettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, ...DEFAULT_COMPANY_SETTINGS },
    });
  }

  // O token CSC e segredo do contribuinte: so o ADMIN ve.
  async getPublic(isAdmin: boolean) {
    const settings = await this.get();
    if (isAdmin) return settings;
    return { ...settings, cscToken: undefined };
  }

  async update(dto: UpdateCompanySettingsDto) {
    await this.get();
    return this.prisma.companySettings.update({
      where: { id: 1 },
      data: {
        ...dto,
        cnpj: dto.cnpj ? onlyDigits(dto.cnpj) : undefined,
        zipCode: dto.zipCode ? onlyDigits(dto.zipCode) : undefined,
        phone: dto.phone !== undefined ? onlyDigits(dto.phone) || null : undefined,
        stateRegistration: dto.stateRegistration ? onlyDigits(dto.stateRegistration) : undefined,
      },
    });
  }

  // Reserva o proximo numero da serie de forma atomica: duas vendas ao
  // mesmo tempo nunca recebem o mesmo numero de nota.
  async reserveNumber(db: Db, model: 'NFE' | 'NFCE'): Promise<{ series: number; number: number }> {
    await this.get(db);
    const field = model === 'NFE' ? 'nfeNextNumber' : 'nfceNextNumber';
    const updated = await db.companySettings.update({
      where: { id: 1 },
      data: { [field]: { increment: 1 } },
    });
    return model === 'NFE'
      ? { series: updated.nfeSeries, number: updated.nfeNextNumber - 1 }
      : { series: updated.nfceSeries, number: updated.nfceNextNumber - 1 };
  }
}
