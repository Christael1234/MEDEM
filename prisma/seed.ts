import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Runs with a plain, unscoped PrismaClient (not PrismaService) — there is
 * no request/tenant context outside a running server, and seeding is
 * trusted admin tooling by nature (same reasoning as PrismaService.raw).
 */
const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123!';

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'greenfield-schools' },
    update: {},
    create: { name: 'Greenfield Schools', slug: 'greenfield-schools', timezone: 'Africa/Lagos' },
  });

  const campus =
    (await prisma.campus.findFirst({ where: { tenantId: tenant.id, name: 'Ikoyi Campus' } })) ??
    (await prisma.campus.create({
      data: { tenantId: tenant.id, name: 'Ikoyi Campus', isPrimary: true },
    }));

  const superAdmin = await upsertUser({
    email: 'superadmin@schoolos.dev',
    tenantId: null,
    role: 'SUPER_ADMIN',
    firstName: 'Femi',
    lastName: 'Adebayo',
    passwordHash,
  });

  const proprietor = await upsertUser({
    email: 'proprietor@greenfield.test',
    tenantId: tenant.id,
    role: 'PROPRIETOR',
    firstName: 'Adetola',
    lastName: 'Okon',
    passwordHash,
  });

  const principal = await upsertUser({
    email: 'principal@greenfield.test',
    tenantId: tenant.id,
    role: 'PRINCIPAL',
    firstName: 'Bolanle',
    lastName: 'Adeyemi',
    passwordHash,
  });

  const bursar = await upsertUser({
    email: 'bursar@greenfield.test',
    tenantId: tenant.id,
    role: 'BURSAR',
    firstName: 'Chinwe',
    lastName: 'Eze',
    passwordHash,
  });

  const hrAdmin = await upsertUser({
    email: 'hr@greenfield.test',
    tenantId: tenant.id,
    role: 'HR_ADMIN',
    firstName: 'Miriam',
    lastName: 'Danjuma',
    passwordHash,
  });

  const parentUser = await upsertUser({
    email: 'parent@greenfield.test',
    tenantId: tenant.id,
    role: 'PARENT',
    firstName: 'Nneka',
    lastName: 'Okafor',
    passwordHash,
  });

  await upsertUser({
    email: 'student@greenfield.test',
    tenantId: tenant.id,
    role: 'STUDENT',
    firstName: 'Ada',
    lastName: 'Okafor',
    passwordHash,
  });

  await upsertUser({
    email: 'transport@greenfield.test',
    tenantId: tenant.id,
    role: 'TRANSPORT_STAFF',
    firstName: 'Kabiru',
    lastName: 'Musa',
    passwordHash,
  });

  await upsertUser({
    email: 'library@greenfield.test',
    tenantId: tenant.id,
    role: 'LIBRARY_STAFF',
    firstName: 'Grace',
    lastName: 'Nwosu',
    passwordHash,
  });

  await upsertUser({
    email: 'otherstaff@greenfield.test',
    tenantId: tenant.id,
    role: 'OTHER_STAFF',
    firstName: 'Samuel',
    lastName: 'Uche',
    passwordHash,
  });

  await upsertUser({
    email: 'compliance@greenfield.test',
    tenantId: tenant.id,
    role: 'COMPLIANCE_ADMIN',
    firstName: 'Yewande',
    lastName: 'Bakare',
    passwordHash,
  });

  const session = await prisma.academicSession.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: '2025/2026' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: '2025/2026',
      startDate: new Date('2025-09-08'),
      endDate: new Date('2026-07-17'),
      isCurrent: true,
    },
  });

  const termNames = ['FIRST', 'SECOND', 'THIRD'] as const;
  const termRanges: [string, string][] = [
    ['2025-09-08', '2025-12-12'],
    ['2026-01-05', '2026-04-01'],
    ['2026-04-20', '2026-07-17'],
  ];
  const terms = [];
  for (let i = 0; i < termNames.length; i++) {
    const term = await prisma.term.upsert({
      where: { academicSessionId_name: { academicSessionId: session.id, name: termNames[i] } },
      update: {},
      create: {
        academicSessionId: session.id,
        name: termNames[i],
        startDate: new Date(termRanges[i][0]),
        endDate: new Date(termRanges[i][1]),
        isCurrent: i === 2,
      },
    });
    terms.push(term);
  }

  // A baseline Subject — class/teacher structure itself is no longer
  // seeded (see note below), but Subject is a standalone reference table
  // classes get mapped to once they exist.
  await prisma.subject.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Mathematics' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Mathematics', code: 'MTH' },
  });

  // Guardian shell for the Parent portal — no student links yet (that's
  // wired up once the Parent module is being finished, same as Student).
  await prisma.guardian.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: parentUser.id,
      firstName: parentUser.firstName,
      lastName: parentUser.lastName,
      email: parentUser.email,
      phone: '+2348012340001',
    },
  });

  // No hardcoded dummy students, classes or teachers — real ones are
  // created through the Students/Classes/Teachers modules (POST /students,
  // POST /classes + /class-arms, POST /staff-profiles/teachers), which
  // auto-generate a linked login (see common/auth/login-credentials.ts).
  // The NumberingService's STUDENT_ID/STAFF_ID sequences start at 1 with
  // no seeding needed here.

  console.log('\nSeed complete. Demo login credentials (all use the same password):\n');
  console.log(`  Password: ${DEMO_PASSWORD}\n`);
  const emails = [
    'superadmin@schoolos.dev',
    'proprietor@greenfield.test',
    'principal@greenfield.test',
    'bursar@greenfield.test',
    'hr@greenfield.test',
    'parent@greenfield.test',
    'student@greenfield.test',
    'transport@greenfield.test',
    'library@greenfield.test',
    'otherstaff@greenfield.test',
    'compliance@greenfield.test',
  ];
  emails.forEach((email) => console.log(`  ${email}`));
  console.log(`\nTenant: ${tenant.name} (${tenant.slug})  Campus: ${campus.name}\n`);

  void superAdmin;
  void proprietor;
  void principal;
  void bursar;
  void hrAdmin;
}

async function upsertUser(params: {
  email: string;
  tenantId: string | null;
  role: Role;
  firstName: string;
  lastName: string;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { email: params.email },
    update: {},
    create: {
      email: params.email,
      tenantId: params.tenantId,
      role: params.role,
      firstName: params.firstName,
      lastName: params.lastName,
      passwordHash: params.passwordHash,
    },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
