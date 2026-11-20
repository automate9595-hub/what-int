import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const prisma: any = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    subscription: { findFirst: jest.fn() },
    session: { updateMany: jest.fn() },
  };
  const audit: any = { log: jest.fn() };
  const service = new UsersService(prisma, audit);
  const admin: any = { sub: 'a1', tenantId: 't1', role: 'TENANT_ADMIN' };

  beforeEach(() => jest.clearAllMocks());

  it('no encuentra usuarios de otra empresa (filtra por tenantId)', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.update(admin, 'x', { name: 'Nuevo' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { id: 'x', tenantId: 't1' } });
  });

  it('impide que un administrador se desactive a sí mismo', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'a1', role: 'TENANT_ADMIN' });
    await expect(service.update(admin, 'a1', { isActive: false })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('respeta el límite de usuarios del plan', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.subscription.findFirst.mockResolvedValue({ plan: { limits: { users: 2 } } });
    prisma.user.count.mockResolvedValue(2);
    await expect(
      service.create(admin, { email: 'n@b.com', name: 'Nico', password: '1234567890', role: 'OPERATOR' as any }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('el superadmin sin empresa no puede usar la gestión de usuarios', async () => {
    await expect(service.list({ sub: 's1', tenantId: null, role: 'SUPER_ADMIN' } as any)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
