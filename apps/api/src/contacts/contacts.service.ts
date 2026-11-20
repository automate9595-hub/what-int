import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types/auth-user';
import { requireTenantId } from '../common/utils/tenant.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto, UpdateContactDto } from './dto/contacts.dto';

export const normalizePhone = (p: string) => {
  const t = p.trim();
  return (t.startsWith('+') ? '+' : '') + t.replace(/\D/g, '');
};

const isDuplicate = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(actor: AuthUser, q?: string) {
    const tenantId = requireTenantId(actor);
    const term = q?.trim().slice(0, 60);
    const digits = term?.replace(/\D/g, '');
    return this.prisma.contact.findMany({
      where: {
        tenantId,
        ...(term ? { OR: [{ name: { contains: term, mode: 'insensitive' as const } }, ...(digits ? [{ phone: { contains: digits } }] : [])] } : {}),
      },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  async get(actor: AuthUser, id: string) {
    const tenantId = requireTenantId(actor);
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
      include: { appointments: { orderBy: { startsAt: 'desc' }, take: 20, include: { service: { select: { name: true } } } } },
    });
    if (!contact) throw new NotFoundException('Cliente no encontrado');
    return contact;
  }

  async create(actor: AuthUser, dto: CreateContactDto) {
    const tenantId = requireTenantId(actor);
    try {
      const created = await this.prisma.contact.create({ data: { ...dto, name: dto.name.trim(), phone: normalizePhone(dto.phone), tenantId } });
      await this.audit.log({ tenantId, userId: actor.sub, action: 'contact.create', entity: 'Contact', entityId: created.id });
      return created;
    } catch (e) {
      if (isDuplicate(e)) throw new ConflictException('Ya existe un cliente con ese teléfono');
      throw e;
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdateContactDto) {
    const tenantId = requireTenantId(actor);
    if (!(await this.prisma.contact.findFirst({ where: { id, tenantId } }))) throw new NotFoundException('Cliente no encontrado');
    try {
      return await this.prisma.contact.update({
        where: { id },
        data: { ...dto, name: dto.name?.trim(), phone: dto.phone ? normalizePhone(dto.phone) : undefined },
      });
    } catch (e) {
      if (isDuplicate(e)) throw new ConflictException('Ya existe un cliente con ese teléfono');
      throw e;
    }
  }
}
