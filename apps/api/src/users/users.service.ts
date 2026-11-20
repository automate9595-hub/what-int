import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types/auth-user';
import { requireTenantId } from '../common/utils/tenant.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';

const select = { id: true, email: true, name: true, role: true, isActive: true, createdAt: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(actor: AuthUser) {
    const tenantId = requireTenantId(actor);
    return this.prisma.user.findMany({ where: { tenantId }, select, orderBy: { createdAt: 'asc' } });
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    const tenantId = requireTenantId(actor);
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('El correo ya está registrado');
    await this.assertUserLimit(tenantId);
    const user = await this.prisma.user.create({
      data: { tenantId, email, name: dto.name.trim(), role: dto.role, passwordHash: await bcrypt.hash(dto.password, 12) },
      select,
    });
    await this.audit.log({ tenantId, userId: actor.sub, action: 'user.create', entity: 'User', entityId: user.id });
    return user;
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const tenantId = requireTenantId(actor);
    // El filtro por tenantId impide tocar usuarios de otras empresas.
    const target = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!target) throw new NotFoundException('Usuario no encontrado');
    if (id === actor.sub && (dto.isActive === false || (dto.role !== undefined && dto.role !== target.role))) {
      throw new BadRequestException('No podés desactivarte ni cambiar tu propio rol');
    }
    const user = await this.prisma.user.update({ where: { id }, data: { name: dto.name?.trim(), role: dto.role, isActive: dto.isActive }, select });
    if (dto.isActive === false) {
      await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.log({ tenantId, userId: actor.sub, action: 'user.update', entity: 'User', entityId: id, metadata: { fields: Object.keys(dto) } });
    return user;
  }

  private async assertUserLimit(tenantId: string) {
    const sub = await this.prisma.subscription.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' }, include: { plan: true } });
    const limit = (sub?.plan.limits as { users?: number } | null)?.users;
    if (limit === undefined) return;
    const count = await this.prisma.user.count({ where: { tenantId } });
    if (count >= limit) throw new ForbiddenException('Alcanzaste el límite de usuarios de tu plan');
  }
}
