/**
 * Ensures every subject has a dedicated, non-overloaded teacher covering
 * every class it applies to (matched by SchoolClass.gradeTier against
 * Subject.gradeTiers, same check SubjectsService.assignTeacher uses).
 * One teacher per (subject, level) — e.g. one "Physics — SS" teacher
 * covering SS1/SS2/SS3, not one teacher per class — so widely-taught
 * subjects still get a single, reasonably-loaded teacher rather than a
 * crowd of near-idle ones.
 *
 * Idempotent: a teacher is identified by firstName=subject name,
 * lastName="<Level> Teacher", so re-running finds and reuses the same
 * accounts. Where an existing TeacherSubjectAssignment already covers a
 * (class, subject) pair with a DIFFERENT teacher, it's replaced with this
 * subject's dedicated teacher — this is local seed/demo data being
 * shaped for clean timetable generation, not a real school's staffing
 * decisions, so reassigning is safe here (never do this against a real
 * tenant's actual data).
 */
import { GradeTier, PrismaClient, SchoolLevel } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const DEFAULT_PORTAL_PASSWORD = 'password123';

const LEVEL_LABEL: Record<SchoolLevel, string> = {
  NURSERY: 'Nursery',
  PRIMARY: 'Primary',
  JUNIOR_SECONDARY: 'JSS',
  SENIOR_SECONDARY: 'SS',
};

async function loginEmailFor(tenantSlug: string, firstName: string, lastName: string): Promise<string> {
  const domain = `${tenantSlug.replace(/-schools?$/i, '') || tenantSlug}.test`;
  const base =
    `${firstName}.${lastName}`
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9.]+/g, '')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '') || 'teacher';
  let candidate = `${base}@${domain}`;
  let n = 1;
  while (await prisma.user.findUnique({ where: { email: candidate } })) {
    n += 1;
    candidate = `${base}${n}@${domain}`;
  }
  return candidate;
}

async function nextStaffId(tenantId: string): Promise<string> {
  let n = (await prisma.staffProfile.count({ where: { tenantId } })) + 1;
  let candidate = `STF-${String(n).padStart(6, '0')}`;
  while (await prisma.staffProfile.findUnique({ where: { tenantId_staffId: { tenantId, staffId: candidate } } })) {
    n += 1;
    candidate = `STF-${String(n).padStart(6, '0')}`;
  }
  return candidate;
}

async function findOrCreateTeacher(tenantId: string, tenantSlug: string, campusId: string, firstName: string, lastName: string) {
  const existingUser = await prisma.user.findFirst({ where: { tenantId, role: 'TEACHER', firstName, lastName } });
  if (existingUser) {
    const staffProfile = await prisma.staffProfile.findUnique({ where: { userId: existingUser.id } });
    if (staffProfile) return staffProfile;
    // A previous run's User got created but its StaffProfile didn't
    // (e.g. interrupted mid-transaction) — finish it rather than erroring.
    const staffId = await nextStaffId(tenantId);
    return prisma.staffProfile.create({
      data: { tenantId, userId: existingUser.id, campusId, staffId, department: 'Teaching', position: `${firstName} Teacher` },
    });
  }

  const email = await loginEmailFor(tenantSlug, firstName, lastName);
  const passwordHash = await bcrypt.hash(DEFAULT_PORTAL_PASSWORD, 12);
  const staffId = await nextStaffId(tenantId);

  const user = await prisma.user.create({ data: { tenantId, role: 'TEACHER', email, passwordHash, firstName, lastName } });
  const staffProfile = await prisma.staffProfile.create({
    data: { tenantId, userId: user.id, campusId, staffId, department: 'Teaching', position: `${firstName} Teacher` },
  });
  console.log(`  created teacher "${firstName} ${lastName}" (${email})`);
  return staffProfile;
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true, name: true } });

  for (const tenant of tenants) {
    console.log(`\n== ${tenant.name} ==`);

    const classes = await prisma.schoolClass.findMany({ where: { tenantId: tenant.id }, select: { id: true, name: true, level: true, gradeTier: true, campusId: true } });
    if (!classes.length) { console.log('  no classes yet, skipping'); continue; }
    const defaultCampusId = classes[0].campusId;

    const subjects = await prisma.subject.findMany({ where: { tenantId: tenant.id } });

    for (const subject of subjects) {
      const applicable = classes.filter((c) => subject.gradeTiers.includes(c.gradeTier as GradeTier));
      if (!applicable.length) continue;

      const byLevel = new Map<SchoolLevel, typeof applicable>();
      for (const c of applicable) {
        const list = byLevel.get(c.level) ?? [];
        list.push(c);
        byLevel.set(c.level, list);
      }

      for (const [level, levelClasses] of byLevel) {
        const teacher = await findOrCreateTeacher(tenant.id, tenant.slug, defaultCampusId, subject.name, `${LEVEL_LABEL[level]} Teacher`);

        for (const cls of levelClasses) {
          const existing = await prisma.teacherSubjectAssignment.findFirst({ where: { schoolClassId: cls.id, subjectId: subject.id } });
          if (existing && existing.staffProfileId === teacher.id) continue;
          if (existing) {
            await prisma.teacherSubjectAssignment.delete({ where: { id: existing.id } });
            console.log(`  reassigned ${subject.name} in ${cls.name} to dedicated teacher`);
          }
          await prisma.teacherSubjectAssignment.create({ data: { schoolClassId: cls.id, subjectId: subject.id, staffProfileId: teacher.id } });
        }
      }
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
