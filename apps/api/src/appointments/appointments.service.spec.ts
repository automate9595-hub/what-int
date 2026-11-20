import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { localToUtc } from '../scheduling/time.util';
import { AppointmentsService } from './appointments.service';

const TZ = 'America/Argentina/Buenos_Aires';
const FUTURE = localToUtc('2030-01-15', 10 * 60, TZ).toISOString();
const ADMIN: any = { sub: 'u1', tenantId: 't1', role: 'TENANT_ADMIN' };
const DTO: any = { contactId: 'c1', serviceId: 's1', startsAt: FUTURE };

describe('AppointmentsService', () => {
  const tx: any = {
    $executeRaw: jest.fn(),
    businessHour: { findMany: jest.fn() },
    appointment: { findFirst: jest.fn(), create: jest.fn() },
    blockedSlot: { findFirst: jest.fn() },
  };
  const prisma: any = {
    contact: { findFirst: jest.fn() },
    service: { findFirst: jest.fn() },
    tenant: { findUnique: jest.fn() },
    $transaction: jest.fn((cb: any) => cb(tx)),
  };
  const audit: any = { log: jest.fn() };
  const service = new AppointmentsService(prisma, audit);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.contact.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.service.findFirst.mockResolvedValue({ id: 's1', durationMin: 30 });
    prisma.tenant.findUnique.mockResolvedValue({ timezone: TZ });
    tx.businessHour.findMany.mockResolvedValue([{ startMin: 9 * 60, endMin: 18 * 60 }]);
    tx.appointment.findFirst.mockResolvedValue(null);
    tx.blockedSlot.findFirst.mockResolvedValue(null);
    tx.appointment.create.mockResolvedValue({ id: 'a1' });
  });

  it('crea la reserva cuando el horario está libre', async () => {
    await expect(service.create(ADMIN, DTO)).resolves.toEqual({ id: 'a1' });
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.appointment.create).toHaveBeenCalled();
  });

  it('rechaza un horario ya ocupado', async () => {
    tx.appointment.findFirst.mockResolvedValue({ id: 'otra' });
    await expect(service.create(ADMIN, DTO)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.appointment.create).not.toHaveBeenCalled();
  });

  it('rechaza un horario bloqueado', async () => {
    tx.blockedSlot.findFirst.mockResolvedValue({ id: 'b1' });
    await expect(service.create(ADMIN, DTO)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza fuera del horario de atención', async () => {
    tx.businessHour.findMany.mockResolvedValue([]);
    await expect(service.create(ADMIN, DTO)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza fechas pasadas', async () => {
    await expect(service.create(ADMIN, { ...DTO, startsAt: '2020-01-01T12:00:00.000Z' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no usa clientes de otra empresa', async () => {
    prisma.contact.findFirst.mockResolvedValue(null);
    await expect(service.create(ADMIN, DTO)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.contact.findFirst).toHaveBeenCalledWith({ where: { id: 'c1', tenantId: 't1' } });
  });
});
