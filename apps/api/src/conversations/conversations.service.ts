import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSender, Prisma } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { requireTenantId } from '../common/utils/tenant.util';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { UpdateConversationDto } from './dto/conversations.dto';

const convInclude = {
  contact: { select: { id: true, name: true, phone: true } },
  number: { select: { phone: true, label: true } },
} satisfies Prisma.ConversationInclude;

const summary = (c: Prisma.ConversationGetPayload<{ include: typeof convInclude }>) => ({
  id: c.id, status: c.status, aiPaused: c.aiPaused, needsHuman: c.needsHuman, unreadCount: c.unreadCount,
  assignedUserId: c.assignedUserId, lastMessageAt: c.lastMessageAt, lastInboundAt: c.lastInboundAt, contact: c.contact, number: c.number,
});

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService, private readonly wa: WhatsappService) {}

  async list(actor: AuthUser, q?: string, status?: string) {
    const tenantId = requireTenantId(actor);
    const term = q?.trim().slice(0, 60);
    const where: Prisma.ConversationWhereInput = {
      tenantId,
      ...(status === 'OPEN' ? { status: ConversationStatus.OPEN } : status === 'CLOSED' ? { status: ConversationStatus.CLOSED } : {}),
      ...(term ? { contact: { OR: [{ name: { contains: term, mode: 'insensitive' as const } }, { phone: { contains: term.replace(/\D/g, '') || term } }] } } : {}),
    };
    const rows = await this.prisma.conversation.findMany({
      where, orderBy: { lastMessageAt: 'desc' }, take: 100,
      include: { ...convInclude, messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, direction: true, createdAt: true } } },
    });
    return rows.map((r) => ({ ...summary(r), last: r.messages[0] ?? null }));
  }

  async get(actor: AuthUser, id: string) {
    const tenantId = requireTenantId(actor);
    const conv = await this.prisma.conversation.findFirst({ where: { id, tenantId }, include: convInclude });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    const messages = await this.prisma.message.findMany({
      where: { conversationId: id }, orderBy: { createdAt: 'desc' }, take: 200,
      select: { id: true, direction: true, sender: true, type: true, body: true, status: true, error: true, createdAt: true },
    });
    if (conv.unreadCount > 0) await this.prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } });
    return { conversation: { ...summary(conv), unreadCount: 0 }, messages: messages.reverse() };
  }

  async send(actor: AuthUser, id: string, text: string) {
    const tenantId = requireTenantId(actor);
    return this.wa.sendText(tenantId, id, text.trim(), MessageSender.HUMAN);
  }

  async update(actor: AuthUser, id: string, dto: UpdateConversationDto) {
    const tenantId = requireTenantId(actor);
    if (!(await this.prisma.conversation.findFirst({ where: { id, tenantId } }))) throw new NotFoundException('Conversación no encontrada');
    if (dto.assignedUserId) {
      if (!(await this.prisma.user.findFirst({ where: { id: dto.assignedUserId, tenantId, isActive: true } }))) throw new BadRequestException('El usuario no pertenece a tu empresa');
    }
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        aiPaused: dto.aiPaused, needsHuman: dto.needsHuman, assignedUserId: dto.assignedUserId,
        status: dto.status === 'OPEN' ? ConversationStatus.OPEN : dto.status === 'CLOSED' ? ConversationStatus.CLOSED : undefined,
      },
      include: convInclude,
    });
    return summary(updated);
  }
}
