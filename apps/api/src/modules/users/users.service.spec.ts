import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';

jest.mock('argon2');

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws ConflictException when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ email: 'a@b.com', password: 'Password123', name: 'A' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password and creates the user with default role OPERATOR', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        name: 'A',
        role: Role.OPERATOR,
        active: true,
      });

      const result = await service.create({ email: 'a@b.com', password: 'Password123', name: 'A' });

      expect(argon2.hash).toHaveBeenCalledWith('Password123');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'a@b.com',
            passwordHash: 'hashed-password',
            role: Role.OPERATOR,
          }),
        }),
      );
      expect(result.role).toBe(Role.OPERATOR);
    });

    it('respects an explicit role when provided', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue({
        id: '2',
        email: 'admin@b.com',
        name: 'Admin',
        role: Role.ADMIN,
        active: true,
      });

      await service.create({
        email: 'admin@b.com',
        password: 'Password123',
        name: 'Admin',
        role: Role.ADMIN,
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: Role.ADMIN }) }),
      );
    });
  });

  describe('findByEmail', () => {
    it('delegates to prisma.user.findUnique by email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'a@b.com' });

      const result = await service.findByEmail('a@b.com');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'a@b.com' } });
      expect(result).toEqual({ id: '1', email: 'a@b.com' });
    });
  });
});
