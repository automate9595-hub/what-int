import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types/auth-user';
import { planLimit } from '../common/utils/limits';
import { requireTenantId } from '../common/utils/tenant.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentDto, UpdateAgentDto } from './dto/agents.dto';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(actor: AuthUser) {
    const tenantId = requireTenantId(actor);
    return this.prisma.agent.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
  }

  async create(actor: AuthUser, dto: CreateAgentDto) {
    const tenantId = requireTenantId(actor);
    const limit = await planLimit(this.prisma, tenantId, 'agents');
    if (limit !== undefined && (await this.prisma.agent.count({ where: { tenantId } })) >= limit) {
      throw new ForbiddenException('Alcanzaste el límite de agentes de tu plan');
    }
    const agent = await this.prisma.agent.create({ data: { ...dto, name: dto.name.trim(), tenantId } });
    await this.audit.log({ tenantId, userId: actor.sub, action: 'agent.create', entity: 'Agent', entityId: agent.id });
    return agent;
  }

  async update(actor: AuthUser, id: string, dto: UpdateAgentDto) {
    const tenantId = requireTenantId(actor);
    if (!(await this.prisma.agent.findFirst({ where: { id, tenantId } }))) throw new NotFoundException('Agente no encontrado');
    const agent = await this.prisma.agent.update({ where: { id }, data: { ...dto, name: dto.name?.trim() } });
    await this.audit.log({ tenantId, userId: actor.sub, action: 'agent.update', entity: 'Agent', entityId: id });
    return agent;
  }
}
