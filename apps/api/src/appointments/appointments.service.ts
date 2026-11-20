import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentSource, AppointmentStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types/auth-user';
import { requireTenantId } from '../common/utils/tenant.util';
import { PrismaService } from '../prisma/prisma.service';
import { dayOfWeek, isValidDate, localToUtc, utcToLocal } from '../scheduling/time.util';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointments.dto';

const include = {
  contact: { select: { id: true, name: true, phone: true } },
  service: { select: { id: true, name: true, durationMin: true } },
} as const;

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async timezone(tenantId: string): Promise<string> {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    if (!t) throw new NotFoundException('Empresa no encontrada');
    return t.timezone;
  }

  /** Un candado por empresa dentro de la transacción: dos reservas simultáneas no pueden pisarse. */
  private lock(tx: Prisma.TransactionClient, tenantId: string) {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}::text))`;
  }

  private async assertSlot(tx: Prisma.TransactionClient, tenantId: string, tz: string, startsAt: Date, endsAt: Date, excludeId?: string) {
    if (startsAt.getTime() <= Date.now()) throw new BadRequestException('No se puede reservar en el pasado');
    const local = utcToLocal(startsAt, tz);
    const duration = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);
    const windows = await tx.businessHour.findMany({ where: { tenantId, dayOfWeek: dayOfWeek(local.dateStr) } });
    if (!windows.some((w) => w.startMin <= local.minutes && local.minutes + duration <= w.endMin)) {
      throw new BadRequestException('El horario está fuera del horario de atención');
    }
    const clash = await tx.appointment.findFirst({
      where: {
        tenantId,
        status: { not: AppointmentStatus.CANCELED },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) throw new ConflictException('Ese horario ya está ocupado');
    const blocked = await tx.blockedSlot.findFirst({ where: { tenantId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { id: true } });
    if (blocked) throw new ConflictException('Ese horario está bloqueado');
  }

  async list(actor: AuthUser, from?: string, to?: string) {
    const tenantId = requireTenantId(actor);
    const tz = await this.timezone(tenantId);
    const f = from ?? utcToLocal(new Date(), tz).dateStr;
    const t = to ?? f;
    if (!isValidDate(f) || !isValidDate(t)) throw new BadRequestException('Las fechas deben tener el formato AAAA-MM-DD');
    if (t < f) throw new BadRequestException('La fecha final no puede ser anterior a la inicial');
    return this.prisma.appointment.findMany({
      where: { tenantId, startsAt: { gte: localToUtc(f, 0, tz), lt: localToUtc(t, 1440, tz) } },
      orderBy: { startsAt: 'asc' },
      take: 500,
      include,
    });
  }

  async create(actor: AuthUser, dto: CreateAppointmentDto) {
    const tenantId = requireTenantId(actor);
    const [contact, service, tz] = await Promise.all([
      this.prisma.contact.findFirst({ where: { id: dto.contactId, tenantId } }),
      this.prisma.service.findFirst({ where: { id: dto.serviceId, tenantId, isActive: true } }),
      this.timezone(tenantId),
    ]);
    if (!contact) throw new NotFoundException('Cliente no encontrado');
    if (!service) throw new NotFoundException('Servicio no encontrado');
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(startsAt.getTime() + service.durationMin * 60000);

    const appt = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, tenantId);
      await this.assertSlot(tx, tenantId, tz, startsAt, endsAt);
      return tx.appointment.create({
        data: {
          tenantId, contactId: contact.id, serviceId: service.id, startsAt, endsAt,
          status: dto.status ?? AppointmentStatus.CONFIRMED, source: AppointmentSource.MANUAL, notes: dto.notes,
        },
        include,
      });
    });
    await this.audit.log({ tenantId, userId: actor.sub, action: 'appointment.create', entity: 'Appointment', entityId: appt.id });
    return appt;
  }

  async update(actor: AuthUser, id: string, dto: UpdateAppointmentDto) {
    const tenantId = requireTenantId(actor);
    const current = await this.prisma.appointment.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException('Reserva no encontrada');
    if (current.status === AppointmentStatus.CANCELED) throw new BadRequestException('Una reserva cancelada no se puede modificar');

    if (dto.startsAt) {
      if (current.status === AppointmentStatus.COMPLETED || current.status === AppointmentStatus.NO_SHOW) {
        throw new BadRequestException('No se puede reprogramar una reserva ya cerrada');
      }
      if (dto.status === AppointmentStatus.CANCELED) throw new BadRequestException('No se puede reprogramar y cancelar a la vez');
      const tz = await this.timezone(tenantId);
      const startsAt = new Date(dto.startsAt);
      const endsAt = new Date(startsAt.getTime() + (current.endsAt.getTime() - current.startsAt.getTime()));
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.lock(tx, tenantId);
        await this.assertSlot(tx, tenantId, tz, startsAt, endsAt, id);
        return tx.appointment.update({ where: { id }, data: { startsAt, endsAt, status: dto.status, notes: dto.notes }, include });
      });
      await this.audit.log({ tenantId, userId: actor.sub, action: 'appointment.reschedule', entity: 'Appointment', entityId: id });
      return updated;
    }

    const updated = await this.prisma.appointment.update({ where: { id }, data: { status: dto.status, notes: dto.notes }, include });
    await this.audit.log({
      tenantId, userId: actor.sub, entity: 'Appointment', entityId: id,
      action: dto.status === AppointmentStatus.CANCELED ? 'appointment.cancel' : 'appointment.update',
    });
    return updated;
  }
}
