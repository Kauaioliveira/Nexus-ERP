import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SuppliersService } from './suppliers.service';

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.20.0',
  });
}

describe('SuppliersService', () => {
  let service: SuppliersService;
  let prisma: {
    supplier: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      supplier: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SuppliersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  describe('create', () => {
    it('creates a supplier', async () => {
      prisma.supplier.create.mockResolvedValue({ id: '1', name: 'Fornecedor A' });

      const result = await service.create({ name: 'Fornecedor A' });

      expect(result).toEqual({ id: '1', name: 'Fornecedor A' });
    });

    it('translates a duplicate document into ConflictException', async () => {
      prisma.supplier.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        service.create({ name: 'Fornecedor B', document: '12345678000199' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findOneOrThrow', () => {
    it('throws NotFoundException when the supplier does not exist', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await expect(service.findOneOrThrow('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('sets active to false without deleting the record', async () => {
      prisma.supplier.findUnique.mockResolvedValue({ id: '1', active: true });
      prisma.supplier.update.mockResolvedValue({ id: '1', active: false });

      const result = await service.deactivate('1');

      expect(prisma.supplier.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { active: false },
      });
      expect(result.active).toBe(false);
    });
  });

  describe('findAll', () => {
    it('applies search and active filters', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);
      prisma.supplier.count.mockResolvedValue(0);

      await service.findAll({ page: 1, pageSize: 20, search: 'acme', active: true });

      const [findManyArgs] = prisma.supplier.findMany.mock.calls[0];
      expect(findManyArgs.where.active).toBe(true);
      expect(findManyArgs.where.OR).toBeDefined();
    });
  });
});
