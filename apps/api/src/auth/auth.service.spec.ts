import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma: any = { user: { findUnique: jest.fn() }, plan: { findUnique: jest.fn() }, session: { create: jest.fn() } };
  const jwt: any = { signAsync: jest.fn().mockResolvedValue('access-token') };
  const config: any = { get: jest.fn() };
  const audit: any = { log: jest.fn() };
  const service = new AuthService(prisma, jwt, config, audit);

  beforeEach(() => jest.clearAllMocks());

  it('rechaza registrar un correo existente', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await expect(
      service.register({ businessName: 'Demo', name: 'Ana', email: 'a@b.com', password: '1234567890' }, {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza contraseña incorrecta', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: await bcrypt.hash('correcta-123', 4), isActive: true, tenant: null });
    await expect(service.login({ email: 'a@b.com', password: 'otra' }, {})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('emite tokens con credenciales válidas', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', tenantId: 't1', role: 'TENANT_ADMIN', passwordHash: await bcrypt.hash('correcta-123', 4), isActive: true, tenant: { status: 'ACTIVE' },
    });
    const res = await service.login({ email: 'a@b.com', password: 'correcta-123' }, {});
    expect(res.accessToken).toBe('access-token');
    expect(res.refreshToken.length).toBeGreaterThan(40);
    expect(prisma.session.create).toHaveBeenCalled();
  });
});
