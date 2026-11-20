import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/** El tenantId sale SIEMPRE del token verificado, nunca del cuerpo de la petición. */
export function requireTenantId(user: AuthUser): string {
  if (!user.tenantId) throw new ForbiddenException('Esta acción requiere pertenecer a una empresa');
  return user.tenantId;
}
