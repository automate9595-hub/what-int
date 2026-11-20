import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const plans = [
  { code: 'inicial', name: 'Inicial', priceCents: 0, limits: { agents: 1, numbers: 1, users: 2, conversations: 300, aiTokens: 200000, storageMb: 100 } },
  { code: 'profesional', name: 'Profesional', priceCents: 0, limits: { agents: 3, numbers: 2, users: 5, conversations: 2000, aiTokens: 1500000, storageMb: 500 } },
  { code: 'empresarial', name: 'Empresarial', priceCents: 0, limits: { agents: 10, numbers: 5, users: 20, conversations: 10000, aiTokens: 8000000, storageMb: 2000 } },
];

async function main() {
  for (const p of plans) {
    await prisma.plan.upsert({ where: { code: p.code }, update: { name: p.name, limits: p.limits }, create: p });
  }
  const email = process.env.SUPERADMIN_EMAIL?.toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!email || !password) throw new Error('Definí SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD');
  const exists = await prisma.user.findUnique({ where: { email } });
  if (!exists) {
    await prisma.user.create({
      data: { email, name: 'Superadministrador', role: UserRole.SUPER_ADMIN, passwordHash: await bcrypt.hash(password, 12) },
    });
    console.log('Superadmin creado:', email);
  } else {
    console.log('Superadmin ya existe:', email);
  }
}

main().finally(() => prisma.$disconnect());
