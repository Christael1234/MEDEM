import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!tenant) throw new Error('No tenant found on this database');
  const passwordHash = await bcrypt.hash('password123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'admin@admin.com' },
    update: { passwordHash, role: 'PROPRIETOR', tenantId: tenant.id },
    create: {
      email: 'admin@admin.com',
      tenantId: tenant.id,
      role: 'PROPRIETOR',
      firstName: 'Admin',
      lastName: 'Admin',
      passwordHash,
    },
  });
  console.log('Created/updated:', user.email, user.role, 'tenant:', tenant.name, tenant.slug);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
