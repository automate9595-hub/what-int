import { Module } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({ imports: [WhatsappModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
