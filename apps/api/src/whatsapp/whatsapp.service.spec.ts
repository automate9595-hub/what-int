import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac } from 'crypto';
import { WhatsappService } from './whatsapp.service';

const CFG: Record<string, string> = { META_APP_SECRET: 'secreto', META_VERIFY_TOKEN: 'token-ok', META_GRAPH_VERSION: 'v25.0' };

describe('WhatsappService', () => {
  const prisma: any = {
    whatsAppNumber: { findUnique: jest.fn() },
    contact: { findFirst: jest.fn(), create: jest.fn() },
    conversation: { upsert: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
    message: { create: jest.fn(), updateMany: jest.fn() },
  };
  const config: any = { get: (k: string) => CFG[k] };
  const crypto: any = { decrypt: jest.fn().mockReturnValue('tok-meta'), encrypt: jest.fn() };
  const audit: any = { log: jest.fn() };
  const svc = new WhatsappService(prisma, config, crypto, audit);

  const payload = (text = 'Hola') => ({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '111' },
      contacts: [{ wa_id: '5491155550000', profile: { name: 'Ana' } }],
      messages: [{ id: 'wamid.1', from: '5491155550000', timestamp: '1760000000', type: 'text', text: { body: text } }],
    } }] }],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.whatsAppNumber.findUnique.mockResolvedValue({ id: 'n1', tenantId: 't1', tenant: { status: 'ACTIVE' } });
    prisma.contact.findFirst.mockResolvedValue(null);
    prisma.contact.create.mockResolvedValue({ id: 'c1' });
    prisma.conversation.upsert.mockResolvedValue({ id: 'cv1' });
    prisma.message.create.mockResolvedValue({});
  });

  describe('seguridad del webhook', () => {
    const raw = Buffer.from('{"a":1}');
    const sig = 'sha256=' + createHmac('sha256', 'secreto').update(raw).digest('hex');
    it('acepta una firma válida', () => expect(svc.verifySignature(raw, sig)).toBe(true));
    it('rechaza una firma inválida o ausente', () => {
      expect(svc.verifySignature(raw, 'sha256=' + 'a'.repeat(64))).toBe(false);
      expect(svc.verifySignature(raw, undefined)).toBe(false);
      expect(svc.verifySignature(undefined, sig)).toBe(false);
    });
    it('verifica el token del webhook', () => {
      expect(svc.verifyToken('token-ok')).toBe(true);
      expect(svc.verifyToken('otro')).toBe(false);
    });
  });

  describe('mensajes entrantes', () => {
    it('crea cliente, conversación y mensaje', async () => {
      await svc.handleWebhook(payload());
      expect(prisma.contact.create.mock.calls[0][0].data).toMatchObject({ tenantId: 't1', phone: '+5491155550000', name: 'Ana' });
      expect(prisma.message.create.mock.calls[0][0].data).toMatchObject({ tenantId: 't1', conversationId: 'cv1', waMessageId: 'wamid.1', body: 'Hola', direction: 'IN' });
      expect(prisma.conversation.update).toHaveBeenCalled();
    });
    it('ignora mensajes repetidos por reintento de Meta', async () => {
      prisma.message.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5' }));
      await svc.handleWebhook(payload());
      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });
    it('ignora números desconocidos', async () => {
      prisma.whatsAppNumber.findUnique.mockResolvedValue(null);
      await svc.handleWebhook(payload());
      expect(prisma.contact.findFirst).not.toHaveBeenCalled();
    });
    it('ignora empresas suspendidas', async () => {
      prisma.whatsAppNumber.findUnique.mockResolvedValue({ id: 'n1', tenantId: 't1', tenant: { status: 'SUSPENDED' } });
      await svc.handleWebhook(payload());
      expect(prisma.message.create).not.toHaveBeenCalled();
    });
  });

  describe('envío', () => {
    const conv = (over: any = {}) => ({
      id: 'cv1', lastInboundAt: new Date(), contact: { phone: '+5491155550000' },
      number: { status: 'CONNECTED', phoneNumberId: '111', accessTokenEnc: 'enc' }, ...over,
    });
    afterEach(() => { delete (global as any).fetch; });

    it('no envía si pasaron más de 24 horas', async () => {
      (global as any).fetch = jest.fn();
      prisma.conversation.findFirst.mockResolvedValue(conv({ lastInboundAt: new Date(Date.now() - 25 * 3600 * 1000) }));
      await expect(svc.sendText('t1', 'cv1', 'Hola', 'HUMAN' as any)).rejects.toBeInstanceOf(BadRequestException);
      expect((global as any).fetch).not.toHaveBeenCalled();
    });
    it('no envía si el número no está conectado', async () => {
      prisma.conversation.findFirst.mockResolvedValue(conv({ number: { status: 'PENDING', phoneNumberId: null, accessTokenEnc: null } }));
      await expect(svc.sendText('t1', 'cv1', 'Hola', 'HUMAN' as any)).rejects.toBeInstanceOf(BadRequestException);
    });
    it('envía por la API de Meta y guarda el mensaje', async () => {
      prisma.conversation.findFirst.mockResolvedValue(conv());
      prisma.message.create.mockResolvedValue({ id: 'm1' });
      (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.out' }] }) });
      await svc.sendText('t1', 'cv1', 'Hola!', 'HUMAN' as any);
      const [url, init] = (global as any).fetch.mock.calls[0];
      expect(url).toBe('https://graph.facebook.com/v25.0/111/messages');
      expect(init.headers.Authorization).toBe('Bearer tok-meta');
      expect(JSON.parse(init.body)).toMatchObject({ to: '5491155550000', text: { body: 'Hola!' } });
      expect(prisma.message.create.mock.calls[0][0].data).toMatchObject({ waMessageId: 'wamid.out', status: 'SENT', direction: 'OUT' });
    });
    it('guarda el fallo si Meta rechaza el mensaje', async () => {
      prisma.conversation.findFirst.mockResolvedValue(conv());
      (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { message: 'token vencido' } }) });
      await expect(svc.sendText('t1', 'cv1', 'Hola', 'HUMAN' as any)).rejects.toThrow('token vencido');
      expect(prisma.message.create.mock.calls[0][0].data).toMatchObject({ status: 'FAILED', error: 'token vencido' });
    });
  });
});
