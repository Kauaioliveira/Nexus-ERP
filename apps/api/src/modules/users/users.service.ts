import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export type SafeUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
};

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Ja existe um usuario com este e-mail.');
    }

    const passwordHash = await argon2.hash(dto.password);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: dto.role ?? Role.OPERATOR,
      },
      select: SAFE_USER_SELECT,
    });
  }

  async findAll(): Promise<SafeUser[]> {
    return this.prisma.user.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      select: SAFE_USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto, actingUserId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    // Evita que o ADMIN se tranque para fora do sistema sem querer.
    if (id === actingUserId && (dto.active === false || (dto.role && dto.role !== Role.ADMIN))) {
      throw new BadRequestException('Voce nao pode desativar nem rebaixar o seu proprio usuario.');
    }

    const passwordHash = dto.password ? await argon2.hash(dto.password) : undefined;

    return this.prisma.$transaction(async (tx) => {
      // Desativar ou trocar a senha derruba as sessoes abertas (refresh
      // tokens); o access token atual expira sozinho em poucos minutos.
      if (dto.active === false || passwordHash) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revoked: false },
          data: { revoked: true },
        });
      }

      return tx.user.update({
        where: { id },
        data: { name: dto.name, role: dto.role, active: dto.active, passwordHash },
        select: SAFE_USER_SELECT,
      });
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findSafeById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT });
  }
}
