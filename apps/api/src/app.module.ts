import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AgentsModule } from './agents/agents.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ConversationsModule } from './conversations/conversations.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ContactsModule } from './contacts/contacts.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { ServicesModule } from './services/services.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './tenant/tenant.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    AdminModule,
    TenantModule,
    UsersModule,
    ServicesModule,
    ContactsModule,
    SchedulingModule,
    AppointmentsModule,
    AgentsModule,
    WhatsappModule,
    ConversationsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
