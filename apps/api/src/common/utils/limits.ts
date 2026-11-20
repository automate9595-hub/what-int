import { PrismaService } from '../../prisma/prisma.service';

/** Devuelve el límite del plan vigente de la empresa o undefined si no hay límite definido. */
export async function planLimit(prisma: PrismaService, tenantId: string, key: string): Promise<number | undefined> {
  const sub = await prisma.subscription.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' }, include: { plan: true } });
  const v = (sub?.plan.limits as Record<string, number> | null)?.[key];
  return typeof v === 'number' ? v : undefined;
}
