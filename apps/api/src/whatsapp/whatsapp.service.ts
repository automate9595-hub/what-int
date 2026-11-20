import { BadGatewayException, BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationStatus, MessageDirection, MessageSender, MessageStatus, NumberStatus, Prisma, TenantStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectNumberDto } from './dto/whatsapp.dto';
import { CryptoService } from './crypto.service';

interface WaMessage {
  id: string; from: string; timestamp?: string; type: string;
  text?: { body?: string }; button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  location?: { latitude?: number; longitude?: number };
}
interface WaStatus { id: string; status: string; errors?: { title?: string; message?: string }[] }
interface WaValue {
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: WaMessage[];
  statuses?: WaStatus[];
}

const WINDOW_MS = 24 * 60 * 60 * 1000;
const isDuplicate = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

const NEXT: Record<string, MessageStatus> = { delivered: MessageStatus.DELIVERED, read: MessageStatus.READ, failed: MessageStatus.FAILED };
const PREV: Record<string, MessageStatus[]> = {
  delivered: [MessageStatus.SENT],
  read: [MessageStatus.SENT, MessageStatus.DELIVERED],
  failed: [MessageStatus.SENT],
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Seguridad del webhook ----------

  verifySignature(raw: Buffer | undefined, header: string | undefined): boolean {
    const secret = this.config.get<string>('META_APP_SECRET');
    if (!secret || !raw || !header?.startsWith('sha256=')) return false;
    const expected = Buffer.from(createHmac('sha256', secret).update(raw).digest('hex'));
    const given = Buffer.from(header.slice(7));
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  verifyToken(token: string | undefined): boolean {
    const expected = this.config.get<string>('META_VERIFY_TOKEN');
    if (!expected || !token) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // ---------- Recepción ----------

  async handleWebhook(payload: unknown): Promise<void> {
    const entries = (payload as { entry?: { changes?: { value?: WaValue }[] }[] } | null)?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;
        for (const msg of value.messages ?? []) {
          try { await this.processInbound(value, msg); } catch (e) { this.logger.error(`Error procesando mensaje ${msg?.id}: ${(e as Error).message}`); }
        }
        for (const st of value.statuses ?? []) {
          try { await this.processStatus(st); } catch (e) { this.logger.error(`Error procesando estado ${st?.id}: ${(e as Error).message}`); }
        }
      }
    }
  }

  private describe(msg: WaMessage): { type: string; body: string | null } {
    switch (msg.type) {
      case 'text': return { type: 'text', body: msg.text?.body ?? null };
      case 'button': return { type: 'button', body: msg.button?.text ?? null };
      case 'interactive': return { type: 'interactive', body: msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? null };
      case 'location': return { type: 'location', body: `[ubicación] ${msg.location?.latitude ?? ''}, ${msg.location?.longitude ?? ''}` };
      default: return { type: msg.type ?? 'unknown', body: `[${msg.type ?? 'mensaje'}]` };
    }
  }

  private async processInbound(value: WaValue, msg: WaMessage) {
    const phoneNumberId = value.metadata?.phone_number_id;
    if (!phoneNumberId || !msg.id || !msg.from) return;
    const number = await this.prisma.whatsAppNumber.findUnique({ where: { phoneNumberId }, include: { tenant: { select: { status: true } } } });
    if (!number || number.tenant.status !== TenantStatus.ACTIVE) return;
    const tenantId = number.tenantId;

    const digits = msg.from.replace(/\D/g, '');
    const plus = `+${digits}`;
    const profileName = value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name?.slice(0, 100);
    let contact = await this.prisma.contact.findFirst({ where: { tenantId, phone: { in: [plus, digits] } } });
    if (!contact) contact = await this.prisma.contact.create({ data: { tenantId, phone: plus, name: profileName ?? plus } });

    const conversation = await this.prisma.conversation.upsert({
      where: { numberId_contactId: { numberId: number.id, contactId: contact.id } },
      update: {},
      create: { tenantId, numberId: number.id, contactId: contact.id },
    });

    const { type, body } = this.describe(msg);
    try {
      await this.prisma.message.create({
        data: {
          tenantId, conversationId: conversation.id, direction: MessageDirection.IN, sender: MessageSender.CONTACT,
          type, body, waMessageId: msg.id, status: MessageStatus.RECEIVED,
          createdAt: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date(),
        },
      });
    } catch (e) {
      if (isDuplicate(e)) return; // Meta reintentó un mensaje ya guardado
      throw e;
    }
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), lastInboundAt: new Date(), unreadCount: { increment: 1 }, status: ConversationStatus.OPEN },
    });
  }

  private async processStatus(s: WaStatus) {
    const next = NEXT[s.status];
    if (!next || !s.id) return;
    await this.prisma.message.updateMany({
      where: { waMessageId: s.id, direction: MessageDirection.OUT, status: { in: PREV[s.status] } },
      data: { status: next, error: next === MessageStatus.FAILED ? (s.errors?.[0]?.title ?? s.errors?.[0]?.message ?? 'Falló el envío') : undefined },
    });
  }

  // ---------- Envío ----------

  private graph(path: string, token: string, init: { method?: string; body?: string } = {}) {
    const version = this.config.get<string>('META_GRAPH_VERSION') ?? 'v25.0';
    return fetch(`https://graph.facebook.com/${version}${path}`, {
      method: init.method ?? 'GET',
      body: init.body,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  }

  async sendText(tenantId: string, conversationId: string, text: string, sender: MessageSender) {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, tenantId }, include: { contact: true, number: true } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    const n = conv.number;
    if (n.status !== NumberStatus.CONNECTED || !n.phoneNumberId || !n.accessTokenEnc) throw new BadRequestException('El número de WhatsApp no está conectado');
    if (!conv.lastInboundAt || Date.now() - conv.lastInboundAt.getTime() > WINDOW_MS) {
      throw new BadRequestException('Pasaron más de 24 horas desde el último mensaje del cliente. WhatsApp solo permite escribirle con una plantilla aprobada (llega en una próxima etapa).');
    }
    const token = this.crypto.decrypt(n.accessTokenEnc);
    const to = conv.contact.phone.replace(/\D/g, '');

    const fail = async (error: string) => {
      await this.prisma.message.create({
        data: { tenantId, conversationId, direction: MessageDirection.OUT, sender, type: 'text', body: text, status: MessageStatus.FAILED, error },
      });
      throw new BadGatewayException(`WhatsApp no pudo enviar el mensaje: ${error}`);
    };

    let res: Response;
    try {
      res = await this.graph(`/${n.phoneNumberId}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body: text, preview_url: false } }),
      });
    } catch {
      return fail('No se pudo conectar con WhatsApp');
    }
    const data = (await res.json().catch(() => null)) as { messages?: { id?: string }[]; error?: { message?: string } } | null;
    if (!res.ok) return fail(data?.error?.message ?? `Error ${res.status}`);

    const message = await this.prisma.message.create({
      data: {
        tenantId, conversationId, direction: MessageDirection.OUT, sender, type: 'text', body: text,
        waMessageId: data?.messages?.[0]?.id, status: MessageStatus.SENT,
      },
      select: { id: true, direction: true, sender: true, type: true, body: true, status: true, error: true, createdAt: true },
    });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
    return message;
  }

  // ---------- Conexión de números (superadmin) ----------

  async connectNumber(actor: AuthUser, numberId: string, dto: ConnectNumberDto) {
    const number = await this.prisma.whatsAppNumber.findUnique({ where: { id: numberId } });
    if (!number) throw new NotFoundException('Número no encontrado');

    let res: Response;
    try {
      res = await this.graph(`/${dto.phoneNumberId}?fields=display_phone_number,verified_name`, dto.accessToken);
    } catch {
      throw new BadGatewayException('No se pudo conectar con Meta para verificar las credenciales');
    }
    const info = (await res.json().catch(() => null)) as { display_phone_number?: string; error?: { message?: string } } | null;
    if (!res.ok) throw new BadRequestException(`Meta rechazó las credenciales: ${info?.error?.message ?? `error ${res.status}`}`);

    const shown = (info?.display_phone_number ?? '').replace(/\D/g, '');
    const warning = shown && shown !== number.phone.replace(/\D/g, '')
      ? `Atención: Meta informa que ese Phone Number ID corresponde a ${info?.display_phone_number}, que no coincide exactamente con ${number.phone}. Verificá que sea el número correcto.`
      : undefined;

    let webhookSubscribed = false;
    if (dto.wabaId) {
      try { webhookSubscribed = (await this.graph(`/${dto.wabaId}/subscribed_apps`, dto.accessToken, { method: 'POST' })).ok; } catch { /* se informa abajo */ }
    }

    try {
      await this.prisma.whatsAppNumber.update({
        where: { id: numberId },
        data: {
          phoneNumberId: dto.phoneNumberId, wabaId: dto.wabaId ?? null, accessTokenEnc: this.crypto.encrypt(dto.accessToken),
          status: NumberStatus.CONNECTED, connectedAt: new Date(),
        },
      });
    } catch (e) {
      if (isDuplicate(e)) throw new ConflictException('Ese Phone Number ID ya está conectado a otro número');
      throw e;
    }
    await this.audit.log({ tenantId: number.tenantId, userId: actor.sub, action: 'admin.number_connect', entity: 'WhatsAppNumber', entityId: numberId });
    return { webhookSubscribed, warning, number: { id: numberId, phone: number.phone, status: NumberStatus.CONNECTED } };
  }

  async disconnectNumber(actor: AuthUser, numberId: string) {
    const number = await this.prisma.whatsAppNumber.findUnique({ where: { id: numberId } });
    if (!number) throw new NotFoundException('Número no encontrado');
    await this.prisma.whatsAppNumber.update({
      where: { id: numberId },
      data: { phoneNumberId: null, wabaId: null, accessTokenEnc: null, connectedAt: null, status: NumberStatus.DISCONNECTED },
    });
    await this.audit.log({ tenantId: number.tenantId, userId: actor.sub, action: 'admin.number_disconnect', entity: 'WhatsAppNumber', entityId: numberId });
    return { ok: true };
  }
}
