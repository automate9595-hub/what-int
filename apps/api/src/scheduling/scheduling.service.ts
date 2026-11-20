import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types/auth-user';
import { requireTenantId } from '../common/utils/tenant.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlockDto, HourDto } from './dto/scheduling.dto';
import { dayOfWeek, hhmm, isValidDate, localToUtc } from './time.util';

const STEP_MIN = 15;

@Injectable()
export class SchedulingService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async getHours(actor: AuthUser) {
    const tenantId = requireTenantId(actor);
    return this.prisma.businessHour.findMany({ where: { tenantId }, orderBy: [{ dayOfWeek: 'asc' }, { startMin: 'asc' }], select: { id: true, dayOfWeek: true, startMin: true, endMin: true } });
  }

  async setHours(actor: AuthUser, hours: HourDto[]) {
    const tenantId = requireTenantId(actor);
    const sorted = [...hours].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMin - b.startMin);
    sorted.forEach((h, i) => {
      if (h.startMin >= h.endMin) throw new BadRequestException('Cada tramo debe terminar después de empezar');
      const next = sorted[i + 1];
      if (next && next.dayOfWeek === h.dayOfWeek && next.startMin < h.endMin) throw new BadRequestException('Hay tramos horarios superpuestos en un mismo día');
    });
    await this.prisma.$transaction([
      this.prisma.businessHour.deleteMany({ where: { tenantId } }),
      this.prisma.businessHour.createMany({ data: sorted.map((h) => ({ tenantId, dayOfWeek: h.dayOfWeek, startMin: h.startMin, endMin: h.endMin })) }),
    ]);
    await this.audit.log({ tenantId, userId: actor.sub, action: 'schedule.hours_update', entity: 'BusinessHour' });
    return this.getHours(actor);
  }

  async listBlocks(actor: AuthUser) {
    const tenantId = requireTenantId(actor);
    return this.prisma.blockedSlot.findMany({ where: { tenantId, endsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' }, take: 200 });
  }

  async createBlock(actor: AuthUser, dto: CreateBlockDto) {
    const tenantId = requireTenantId(actor);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('El bloqueo debe terminar después de empezar');
    const block = await this.prisma.blockedSlot.create({ data: { tenantId, startsAt, endsAt, reason: dto.reason } });
    await this.audit.log({ tenantId, userId: actor.sub, action: 'schedule.block_create', entity: 'BlockedSlot', entityId: block.id });
    return block;
  }

  async deleteBlock(actor: AuthUser, id: string) {
    const tenantId = requireTenantId(actor);
    const res = await this.prisma.blockedSlot.deleteMany({ where: { id, tenantId } });
    if (res.count === 0) throw new NotFoundException('Bloqueo no encontrado');
    return { ok: true };
  }

  async availability(actor: AuthUser, date: string, serviceId: string) {
    const tenantId = requireTenantId(actor);
    if (!isValidDate(date)) throw new BadRequestException('La fecha debe tener el formato AAAA-MM-DD');
    const [service, tenant] = await Promise.all([
      this.prisma.service.findFirst({ where: { id: serviceId, tenantId, isActive: true } }),
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
    ]);
    if (!service || !tenant) throw new NotFoundException('Servicio no encontrado');
    const tz = tenant.timezone;

    const windows = await this.prisma.businessHour.findMany({ where: { tenantId, dayOfWeek: dayOfWeek(date) }, orderBy: { startMin: 'asc' } });
    if (windows.length === 0) return { date, slots: [] as { startsAt: string; label: string }[] };

    const dayStart = localToUtc(date, 0, tz);
    const dayEnd = localToUtc(date, 1440, tz);
    const [appts, blocks] = await Promise.all([
      this.prisma.appointment.findMany({ where: { tenantId, status: { not: AppointmentStatus.CANCELED }, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } }, select: { startsAt: true, endsAt: true } }),
      this.prisma.blockedSlot.findMany({ where: { tenantId, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } }, select: { startsAt: true, endsAt: true } }),
    ]);
    const busy = [...appts, ...blocks];
    const now = Date.now();
    const slots: { startsAt: string; label: string }[] = [];
    for (const w of windows) {
      for (let m = w.startMin; m + service.durationMin <= w.endMin; m += STEP_MIN) {
        const s = localToUtc(date, m, tz);
        const e = localToUtc(date, m + service.durationMin, tz);
        if (s.getTime() <= now) continue;
        if (busy.some((b) => b.startsAt < e && b.endsAt > s)) continue;
        slots.push({ startsAt: s.toISOString(), label: hhmm(m) });
      }
    }
    return { date, slots };
  }
}
