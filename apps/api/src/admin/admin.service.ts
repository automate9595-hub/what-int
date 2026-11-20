import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TenantStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlanDto } from './dto/admin.dto';

const tenantInclude = {
  _count: { select: { users: true } },
  subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } },
} satisfies Prisma.TenantInclude;

type TenantFull = Prisma.TenantGetPayload<{ include: typeof tenantInclude }>;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private summary(t: TenantFull) {
    const sub = t.subscriptions[0];
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      createdAt: t.createdAt,
      users: t._count.users,
      subscription: sub
        ? { status: sub.status, currentPeriodEnd: sub.currentPeriodEnd, plan: { code: sub.plan.code, name: sub.plan.name } }
        : null,
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
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, include: tenantInclude });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');
    return this.summary(tenant);
  }

  async setTenantStatus(actor: AuthUser, id: string, status: TenantStatus) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');
    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({ where: { id }, data: { status } });
      if (status === TenantStatus.SUSPENDED) {
        await tx.session.updateMany({ where: { revokedAt: null, user: { tenantId: id } }, data: { revokedAt: new Date() } });
      }
    });
    await this.audit.log({ tenantId: id, userId: actor.sub, action: 'admin.tenant_status', entity: 'Tenant', entityId: id, metadata: { status } });
    return this.getTenant(id);
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
