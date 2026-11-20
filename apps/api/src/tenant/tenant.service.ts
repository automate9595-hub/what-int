import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types/auth-user';
import { requireTenantId } from '../common/utils/tenant.util';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async me(actor: AuthUser) {
    const tenantId = requireTenantId(actor);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { _count: { select: { users: true } }, subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } } },
    });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');
    const sub = tenant.subscriptions[0];
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      subscription: sub
        ? { status: sub.status, currentPeriodEnd: sub.currentPeriodEnd, plan: { code: sub.plan.code, name: sub.plan.name, limits: sub.plan.limits } }
        : null,
      usage: { users: tenant._count.users },
    };
  }

  async rename(actor: AuthUser, name: string) {
    const tenantId = requireTenantId(actor);
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { name: name.trim() } });
    await this.audit.log({ tenantId, userId: actor.sub, action: 'tenant.rename', entity: 'Tenant', entityId: tenantId });
    return this.me(actor);
  }
}
