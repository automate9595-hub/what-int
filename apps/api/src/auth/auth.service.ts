import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SubscriptionStatus, TenantStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export const slugify = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) +
  '-' + randomBytes(3).toString('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta) {
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('El correo ya está registrado');
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const plan = await this.prisma.plan.findUnique({ where: { code: 'inicial' } });

    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: dto.businessName.trim(), slug: slugify(dto.businessName) } });
      const created = await tx.user.create({
        data: { tenantId: tenant.id, email, passwordHash, name: dto.name.trim(), role: UserRole.TENANT_ADMIN },
      });
      if (plan) {
        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: plan.id,
            status: SubscriptionStatus.TRIALING,
            currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        });
      }
      return created;
    });

    await this.audit.log({ tenantId: user.tenantId, userId: user.id, action: 'auth.register', entity: 'Tenant', entityId: user.tenantId ?? undefined, ip: meta.ip });
    return this.issueTokens(user, meta);
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email }, include: { tenant: true } });
    const ok = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !ok) {
      await this.audit.log({ action: 'auth.login_failed', metadata: { email }, ip: meta.ip });
      throw new UnauthorizedException('Credenciales inválidas');
    }
    this.assertActive(user);
    await this.audit.log({ tenantId: user.tenantId, userId: user.id, action: 'auth.login', ip: meta.ip });
    return this.issueTokens(user, meta);
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: { include: { tenant: true } } },
    });
    if (!session) throw new UnauthorizedException('Sesión inválida');
    if (session.revokedAt) {
      // Reutilización de un token ya rotado: posible robo, se cierran todas las sesiones.
      await this.prisma.session.updateMany({ where: { userId: session.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log({ tenantId: session.user.tenantId, userId: session.userId, action: 'auth.refresh_reuse_detected', ip: meta.ip });
      throw new UnauthorizedException('Sesión inválida');
    }
    if (session.expiresAt < new Date()) throw new UnauthorizedException('Sesión vencida');
    this.assertActive(session.user);
    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(session.user, meta);
  }

  async logout(refreshToken: string) {
    await this.prisma.session.updateMany({ where: { tokenHash: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { tenant: true } });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenant: user.tenant ? { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug, status: user.tenant.status } : null,
    };
  }

  private assertActive(user: { isActive: boolean; tenant?: { status: TenantStatus } | null }) {
    if (!user.isActive || (user.tenant && user.tenant.status !== TenantStatus.ACTIVE)) {
      throw new ForbiddenException('La cuenta está suspendida');
    }
  }

  private async issueTokens(user: { id: string; tenantId: string | null; role: UserRole }, meta: RequestMeta) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, tenantId: user.tenantId, role: user.role });
    const refreshToken = randomBytes(48).toString('base64url');
    const days = Number(this.config.get('REFRESH_TTL_DAYS') ?? 30);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 250),
      },
    });
    return { accessToken, refreshToken };
  }
}
