import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types/auth-user';
import { requireTenantId } from '../common/utils/tenant.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/services.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(actor: AuthUser) {
    const tenantId = requireTenantId(actor);
    return this.prisma.service.findMany({ where: { tenantId }, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  }

  async create(actor: AuthUser, dto: CreateServiceDto) {
    const tenantId = requireTenantId(actor);
    const created = await this.prisma.service.create({ data: { ...dto, name: dto.name.trim(), tenantId } });
    await this.audit.log({ tenantId, userId: actor.sub, action: 'service.create', entity: 'Service', entityId: created.id });
    return created;
  }

  async update(actor: AuthUser, id: string, dto: UpdateServiceDto) {
    const tenantId = requireTenantId(actor);
    if (!(await this.prisma.service.findFirst({ where: { id, tenantId } }))) throw new NotFoundException('Servicio no encontrado');
    const updated = await this.prisma.service.update({ where: { id }, data: { ...dto, name: dto.name?.trim() } });
    await this.audit.log({ tenantId, userId: actor.sub, action: 'service.update', entity: 'Service', entityId: id });
    return updated;
  }
}
