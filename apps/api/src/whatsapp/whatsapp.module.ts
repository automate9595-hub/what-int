import { Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({ controllers: [WhatsappController], providers: [WhatsappService, CryptoService], exports: [WhatsappService] })
export class WhatsappModule {}
