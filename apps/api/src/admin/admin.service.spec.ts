import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminService } from './admin.service';

const DTO: any = {
  name: 'Peluquería Sol', planCode: 'inicial',
  admin: { name: 'Ana', email: 'Ana@Correo.com', password: '1234567890' },
  numbers: [{ phone: '+54 9 11 5555-0000', label: 'Principal' }],
};

describe('AdminService.createTenant', () => {
  const tx: any = {
    tenant: { create: jest.fn() }, user: { create: jest.fn() }, subscription: { create: jest.fn() }, whatsAppNumber: { createMany: jest.fn() },
  };
  const prisma: any = {
    user: { findUnique: jest.fn() }, plan: { findUnique: jest.fn() },
    whatsAppNumber: { findMany: jest.fn() }, tenant: { findUnique: jest.fn() },
    $transaction: jest.fn((cb: any) => cb(tx)),
  };
  const audit: any = { log: jest.fn() };
  const service = new AdminService(prisma, audit);
  const actor: any = { sub: 'sa', tenantId: null, role: 'SUPER_ADMIN' };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.plan.findUnique.mockResolvedValue({ id: 'p1', name: 'Inicial', isActive: true, limits: { numbers: 1 } });
    prisma.whatsAppNumber.findMany.mockResolvedValue([]);
    tx.tenant.create.mockResolvedValue({ id: 't1' });
    prisma.tenant.findUnique.mockResolvedValue({
      id: 't1', name: 'Peluquería Sol', slug: 's', status: 'ACTIVE', timezone: 'America/Argentina/Buenos_Aires', createdAt: new Date(),
      contactPhone: null, address: null, city: null, province: null, country: 'Argentina', subscriptions: [], users: [], whatsappNumbers: [],
    });
  });

  it('crea empresa, administrador, suscripción y números', async () => {
    const res = await service.createTenant(actor, DTO);
    expect(res.id).toBe('t1');
    expect(tx.user.create.mock.calls[0][0].data).toMatchObject({ tenantId: 't1', email: 'ana@correo.com', role: 'TENANT_ADMIN' });
    expect(tx.subscription.create.mock.calls[0][0].data).toMatchObject({ tenantId: 't1', planId: 'p1', status: 'ACTIVE' });
    expect(tx.whatsAppNumber.createMany.mock.calls[0][0].data[0]).toMatchObject({ tenantId: 't1', phone: '+5491155550000' });
  });

  it('rechaza un correo ya registrado', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u' });
    await expect(service.createTenant(actor, DTO)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza un plan inexistente o inactivo', async () => {
    prisma.plan.findUnique.mockResolvedValue({ id: 'p1', isActive: false });
    await expect(service.createTenant(actor, DTO)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza más números que los del plan', async () => {
    await expect(service.createTenant(actor, { ...DTO, numbers: [{ phone: '1111111' }, { phone: '2222222' }] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un número ya asignado a otra empresa', async () => {
    prisma.whatsAppNumber.findMany.mockResolvedValue([{ phone: '+5491155550000' }]);
    await expect(service.createTenant(actor, DTO)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.tenant.create).not.toHaveBeenCalled();
  });
});
