import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('argon2');

const ACTIVE_USER = {
  id: 'user-1',
  email: 'user@nexus.local',
  name: 'User',
  role: Role.OPERATOR,
  active: true,
  passwordHash: 'stored-hash',
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByEmail: jest.Mock };
  let prisma: {
    refreshToken: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
  };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    usersService = { findByEmail: jest.fn() };
    prisma = {
      refreshToken: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-access-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const values: Record<string, string> = {
                JWT_ACCESS_SECRET: 'access-secret',
                JWT_ACCESS_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return values[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    prisma.refreshToken.create.mockResolvedValue({});
  });

  describe('validateUser', () => {
    it('throws UnauthorizedException when user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.validateUser('missing@nexus.local', 'pw')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user is inactive', async () => {
      usersService.findByEmail.mockResolvedValue({ ...ACTIVE_USER, active: false });

      await expect(service.validateUser(ACTIVE_USER.email, 'pw')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when password does not match', async () => {
      usersService.findByEmail.mockResolvedValue(ACTIVE_USER);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser(ACTIVE_USER.email, 'wrong')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('returns the user when credentials are valid', async () => {
      usersService.findByEmail.mockResolvedValue(ACTIVE_USER);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(ACTIVE_USER.email, 'correct');

      expect(result).toEqual(ACTIVE_USER);
    });
  });

  describe('login', () => {
    it('issues an access and refresh token pair for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(ACTIVE_USER);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login(ACTIVE_USER.email, 'correct');

      expect(result.accessToken).toBe('signed-access-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(20);
      expect(result.user.email).toBe(ACTIVE_USER.email);
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('throws when the refresh token is not found', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('unknown-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when the refresh token was already revoked', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        revoked: true,
        expiresAt: new Date(Date.now() + 100_000),
        user: ACTIVE_USER,
      });

      await expect(service.refresh('used-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when the refresh token is expired', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        revoked: false,
        expiresAt: new Date(Date.now() - 1000),
        user: ACTIVE_USER,
      });

      await expect(service.refresh('expired-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rotates the token and issues a new pair when valid', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        revoked: false,
        expiresAt: new Date(Date.now() + 100_000),
        user: ACTIVE_USER,
      });

      const result = await service.refresh('valid-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revoked: true },
      });
      expect(result.accessToken).toBe('signed-access-token');
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the matching non-revoked refresh token', async () => {
      await service.logout('some-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ revoked: false }),
          data: { revoked: true },
        }),
      );
    });
  });
});
