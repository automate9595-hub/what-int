import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types/auth-user';
import { requireTenantId } from '../common/utils/tenant.util';
import { assertTimezone } from '../common/utils/tz.util';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMyTenantDto } from './dto/tenant.dto';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async me(actor: AuthUser) {
    const tenantId = requireTenantId(actor);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: { select: { users: true } },
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } },
        whatsappNumbers: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');
    const sub = tenant.subscriptions[0];
    return {
      id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status, timezone: tenant.timezone,
      contactPhone: tenant.contactPhone, address: tenant.address, city: tenant.city, province: tenant.province, country: tenant.country,
      subscription: sub
        ? { status: sub.status, currentPeriodEnd: sub.currentPeriodEnd, plan: { code: sub.plan.code, name: sub.plan.name, limits: sub.plan.limits } }
        : null,
      usage: { users: tenant._count.users },
      numbers: tenant.whatsappNumbers.map((n) => ({ id: n.id, phone: n.phone, label: n.label, mode: n.mode, status: n.status })),
    };
  }

  async update(actor: AuthUser, dto: UpdateMyTenantDto) {
    const tenantId = requireTenantId(actor);
    if (dto.timezone) assertTimezone(dto.timezone);
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { ...dto, name: dto.name?.trim() } });
    await this.audit.log({ tenantId, userId: actor.sub, action: 'tenant.update', entity: 'Tenant', entityId: tenantId });
    return this.me(actor);
  }
}
