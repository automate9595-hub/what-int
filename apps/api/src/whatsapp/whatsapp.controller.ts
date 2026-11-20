import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post, Query, RawBodyRequest, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { WhatsappService } from './whatsapp.service';

@ApiTags('webhooks')
@SkipThrottle()
@Controller('webhooks/whatsapp')
export class WhatsappController {
  constructor(private readonly wa: WhatsappService) {}

  /** Verificación inicial que hace Meta al registrar el webhook. */
  @Public()
  @Get()
  verify(@Query('hub.mode') mode?: string, @Query('hub.verify_token') token?: string, @Query('hub.challenge') challenge?: string) {
    if (mode !== 'subscribe' || !this.wa.verifyToken(token)) throw new ForbiddenException('Token de verificación inválido');
    return challenge ?? '';
  }

  /** Mensajes y estados. Solo se aceptan pedidos firmados por Meta. */
  @Public()
  @Post()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>, @Headers('x-hub-signature-256') signature: string | undefined, @Body() body: unknown) {
    if (!this.wa.verifySignature(req.rawBody, signature)) throw new UnauthorizedException('Firma inválida');
    await this.wa.handleWebhook(body);
    return { ok: true };
  }
}
