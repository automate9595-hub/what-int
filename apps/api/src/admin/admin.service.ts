import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NumberMode, Prisma, SubscriptionStatus, TenantStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { slugify } from '../auth/auth.service';
import { AuthUser } from '../common/types/auth-user';
import { planLimit } from '../common/utils/limits';
import { assertTimezone } from '../common/utils/tz.util';
import { normalizePhone } from '../contacts/contacts.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto, NumberDto, UpdatePlanDto, UpdateSubscriptionDto, UpdateTenantDto } from './dto/admin.dto';

const tenantInclude = {
  _count: { select: { users: true } },
  subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } },
} satisfies Prisma.TenantInclude;

const detailInclude = {
  subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } },
  users: { select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
  whatsappNumbers: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.TenantInclude;

type TenantFull = Prisma.TenantGetPayload<{ include: typeof tenantInclude }>;

const DAY = 24 * 60 * 60 * 1000;
const isDuplicate = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private summary(t: TenantFull) {
    const sub = t.subscriptions[0];
    return {
      id: t.id, name: t.name, slug: t.slug, status: t.status, createdAt: t.createdAt, users: t._count.users,
      subscription: sub ? { status: sub.status, currentPeriodEnd: sub.currentPeriodEnd, plan: { code: sub.plan.code, name: sub.plan.name } } : null,
    };
  }

  async listTenants(limit: number, offset: number) {
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({ orderBy: { createdAt: 'desc' }, take: limit, skip: offset, include: tenantInclude }),
      this.prisma.tenant.count(),
    ]);
    return { total, items: items.map((t) => this.summary(t)) };
  }

  async getTenant(id: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id }, include: detailInclude });
    if (!t) throw new NotFoundException('Empresa no encontrada');
    const sub = t.subscriptions[0];
    return {
      id: t.id, name: t.name, slug: t.slug, status: t.status, timezone: t.timezone, createdAt: t.createdAt,
      contactPhone: t.contactPhone, address: t.address, city: t.city, province: t.province, country: t.country,
      subscription: sub ? { id: sub.id, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd, plan: { id: sub.plan.id, code: sub.plan.code, name: sub.plan.name } } : null,
      users: t.users,
      numbers: t.whatsappNumbers.map((n) => ({ id: n.id, phone: n.phone, label: n.label, mode: n.mode, status: n.status })),
    };
  }

  async createTenant(actor: AuthUser, dto: CreateTenantDto) {
    const email = dto.admin.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('El correo del administrador ya está registrado');
    const plan = await this.prisma.plan.findUnique({ where: { code: dto.planCode } });
    if (!plan || !plan.isActive) throw new BadRequestException('El plan elegido no existe o no está disponible');
    if (dto.timezone) assertTimezone(dto.timezone);

    const numbers = (dto.numbers ?? []).map((n) => ({ phone: normalizePhone(n.phone), label: n.label?.trim() || null, mode: n.mode ?? NumberMode.PLATFORM }));
    if (new Set(numbers.map((n) => n.phone)).size !== numbers.length) throw new BadRequestException('Hay números repetidos');
    const limit = (plan.limits as Record<string, number> | null)?.numbers;
    if (typeof limit === 'number' && numbers.length > limit) throw new BadRequestException(`El plan ${plan.name} permite hasta ${limit} números`);
    if (numbers.length) {
      const taken = await this.prisma.whatsAppNumber.findMany({ where: { phone: { in: numbers.map((n) => n.phone) } }, select: { phone: true } });
      if (taken.length) throw new ConflictException(`El número ${taken[0].phone} ya está asignado a otra empresa`);
    }

    const passwordHash = await bcrypt.hash(dto.admin.password, 12);
    const trial = !!dto.trialDays && dto.trialDays > 0;
    const tenant = await this.prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          name: dto.name.trim(), slug: slugify(dto.name), timezone: dto.timezone,
          contactPhone: dto.contactPhone, address: dto.address, city: dto.city, province: dto.province, country: dto.country,
        },
      });
      await tx.user.create({ data: { tenantId: t.id, email, name: dto.admin.name.trim(), passwordHash, role: UserRole.TENANT_ADMIN } });
      await tx.subscription.create({
        data: {
          tenantId: t.id, planId: plan.id,
          status: trial ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
          currentPeriodEnd: new Date(Date.now() + (trial ? dto.trialDays! : 30) * DAY),
        },
      });
      if (numbers.length) await tx.whatsAppNumber.createMany({ data: numbers.map((n) => ({ ...n, tenantId: t.id })) });
      return t;
    });
    await this.audit.log({ tenantId: tenant.id, userId: actor.sub, action: 'admin.tenant_create', entity: 'Tenant', entityId: tenant.id });
    return this.getTenant(tenant.id);
  }

  async updateTenant(actor: AuthUser, id: string, dto: UpdateTenantDto) {
    if (!(await this.prisma.tenant.findUnique({ where: { id } }))) throw new NotFoundException('Empresa no encontrada');
    if (dto.timezone) assertTimezone(dto.timezone);
    await this.prisma.tenant.update({ where: { id }, data: { ...dto, name: dto.name?.trim() } });
    await this.audit.log({ tenantId: id, userId: actor.sub, action: 'admin.tenant_update', entity: 'Tenant', entityId: id });
    return this.getTenant(id);
  }

  async setTenantStatus(actor: AuthUser, id: string, status: TenantStatus) {
    if (!(await this.prisma.tenant.findUnique({ where: { id } }))) throw new NotFoundException('Empresa no encontrada');
    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({ where: { id }, data: { status } });
      if (status === TenantStatus.SUSPENDED) {
        await tx.session.updateMany({ where: { revokedAt: null, user: { tenantId: id } }, data: { revokedAt: new Date() } });
      }
    });
    await this.audit.log({ tenantId: id, userId: actor.sub, action: 'admin.tenant_status', entity: 'Tenant', entityId: id, metadata: { status } });
    return this.getTenant(id);
  }

  async updateSubscription(actor: AuthUser, tenantId: string, dto: UpdateSubscriptionDto) {
    if (!(await this.prisma.tenant.findUnique({ where: { id: tenantId } }))) throw new NotFoundException('Empresa no encontrada');
    const current = await this.prisma.subscription.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    let planId = current?.planId;
    if (dto.planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
      if (!plan) throw new BadRequestException('Plan no encontrado');
      planId = plan.id;
    }
    if (!planId) throw new BadRequestException('Elegí un plan');
    const end = dto.currentPeriodEnd ? new Date(dto.currentPeriodEnd) : undefined;
    if (current) {
      await this.prisma.subscription.update({ where: { id: current.id }, data: { planId, status: dto.status, currentPeriodEnd: end } });
    } else {
      await this.prisma.subscription.create({ data: { tenantId, planId, status: dto.status ?? SubscriptionStatus.ACTIVE, currentPeriodEnd: end ?? new Date(Date.now() + 30 * DAY) } });
    }
    await this.audit.log({ tenantId, userId: actor.sub, action: 'admin.subscription_update', entity: 'Subscription', metadata: { planId, status: dto.status ?? null } });
    return this.getTenant(tenantId);
  }

  async addNumber(actor: AuthUser, tenantId: string, dto: NumberDto) {
    if (!(await this.prisma.tenant.findUnique({ where: { id: tenantId } }))) throw new NotFoundException('Empresa no encontrada');
    const limit = await planLimit(this.prisma, tenantId, 'numbers');
    if (limit !== undefined && (await this.prisma.whatsAppNumber.count({ where: { tenantId } })) >= limit) {
      throw new ForbiddenException('El plan de esta empresa no admite más números');
    }
    try {
      await this.prisma.whatsAppNumber.create({
        data: { tenantId, phone: normalizePhone(dto.phone), label: dto.label?.trim() || null, mode: dto.mode ?? NumberMode.PLATFORM },
      });
    } catch (e) {
      if (isDuplicate(e)) throw new ConflictException('Ese número ya está asignado a otra empresa');
      throw e;
    }
    await this.audit.log({ tenantId, userId: actor.sub, action: 'admin.number_add', entity: 'WhatsAppNumber' });
    return this.getTenant(tenantId);
  }

  async removeNumber(actor: AuthUser, id: string) {
    const number = await this.prisma.whatsAppNumber.findUnique({ where: { id } });
    if (!number) throw new NotFoundException('Número no encontrado');
    await this.prisma.whatsAppNumber.delete({ where: { id } });
    await this.audit.log({ tenantId: number.tenantId, userId: actor.sub, action: 'admin.number_remove', entity: 'WhatsAppNumber', entityId: id });
    return this.getTenant(number.tenantId);
  }

  async resetPassword(actor: AuthUser, userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role === UserRole.SUPER_ADMIN) throw new NotFoundException('Usuario no encontrado');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 12) } });
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ tenantId: user.tenantId, userId: actor.sub, action: 'admin.password_reset', entity: 'User', entityId: userId });
    return { ok: true };
  }

  listPlans() {
    return this.prisma.plan.findMany({ orderBy: { priceCents: 'asc' } });
  }

  async updatePlan(actor: AuthUser, id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    const updated = await this.prisma.plan.update({
      where: { id },
      data: { name: dto.name, priceCents: dto.priceCents, isActive: dto.isActive, limits: dto.limits as Prisma.InputJsonValue | undefined },
    });
    await this.audit.log({ userId: actor.sub, action: 'admin.plan_update', entity: 'Plan', entityId: id, metadata: { fields: Object.keys(dto) } });
    return updated;
  }

  auditLogs(limit: number) {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }
}
