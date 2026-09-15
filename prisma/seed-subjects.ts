/**
 * Seeds the real Nigerian curriculum subject list — Basic Education (2024
 * NERDC reform) for Primary/JSS, plus the fuller Senior Secondary
 * curriculum (5 compulsory subjects, a required core trade subject, and
 * Science/Art stream electives) that backs the SS subject self-selection
 * feature. Idempotent and safe to re-run — upserts by (tenantId, name) —
 * and safe to run against any tenant's data, local or Render, via
 * DATABASE_URL.
 *
 * Every Senior Secondary subject here is tagged `isCompulsory`,
 * `isCoreTrade`, or `streams` (Science/Art) — see the doc comment on
 * `Subject.streams` in schema.prisma for why a "regular" SS subject must
 * always carry a stream tag going forward.
 *
 * Subjects superseded by this list ("Language", "National Values
 * Education", "Religion" — now "Religion and National Values") are only
 * deleted if they have zero results on record; results are ledger-like
 * (CLAUDE.md) and never silently dropped. "Civic Education" is narrowed to
 * drop Senior Secondary (superseded there by "Citizenship and Heritage
 * Studies", but still valid at Primary/JSS) under the same safety rule.
 * Any other subject with results that doesn't match this list at all
 * (e.g. a legacy "English Studies" some schools may have) is left
 * untouched and reported, not renamed either — renaming a subject with
 * real grades on it would misrepresent history.
 */
import { GradeTier, PrismaClient, Stream } from '@prisma/client';

const prisma = new PrismaClient();

type SubjectSeed = {
  name: string;
  gradeTiers: GradeTier[];
  streams?: Stream[];
  isCompulsory?: boolean;
  isCoreTrade?: boolean;
};

const TARGET_SUBJECTS: SubjectSeed[] = [
  // Compulsory (Primary/JSS-wide, or Senior-Secondary-specific)
  { name: 'English Language', gradeTiers: ['LOWER_PRIMARY', 'UPPER_PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY'], isCompulsory: true },
  { name: 'Mathematics', gradeTiers: ['LOWER_PRIMARY', 'UPPER_PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY'], isCompulsory: true },
  { name: 'Citizenship and Heritage Studies', gradeTiers: ['SENIOR_SECONDARY'], isCompulsory: true },
  { name: 'Digital Technologies', gradeTiers: ['SENIOR_SECONDARY'], isCompulsory: true },
  { name: 'Basic Science and Technology', gradeTiers: ['LOWER_PRIMARY', 'UPPER_PRIMARY', 'JUNIOR_SECONDARY'] },
  { name: 'Cultural and Creative Arts', gradeTiers: ['LOWER_PRIMARY', 'UPPER_PRIMARY', 'JUNIOR_SECONDARY'] },
  { name: 'Religion and National Values', gradeTiers: ['LOWER_PRIMARY', 'UPPER_PRIMARY', 'JUNIOR_SECONDARY'] },
  { name: 'Nigerian Language', gradeTiers: ['LOWER_PRIMARY', 'UPPER_PRIMARY', 'JUNIOR_SECONDARY'] },
  { name: 'Pre-Vocational Studies', gradeTiers: ['UPPER_PRIMARY', 'JUNIOR_SECONDARY'] },
  { name: 'Business Studies', gradeTiers: ['JUNIOR_SECONDARY', 'SENIOR_SECONDARY'] },

  // Core trade (every Senior Secondary student picks exactly one)
  { name: 'Solar PV Installation and Maintenance', gradeTiers: ['SENIOR_SECONDARY'], isCoreTrade: true },
  { name: 'Fashion Design and Garment Making', gradeTiers: ['SENIOR_SECONDARY'], isCoreTrade: true },
  { name: 'Livestock Farming', gradeTiers: ['SENIOR_SECONDARY'], isCoreTrade: true },
  { name: 'Beauty and Cosmetology', gradeTiers: ['SENIOR_SECONDARY'], isCoreTrade: true },
  { name: 'Computer Hardware and GSM Repairs', gradeTiers: ['SENIOR_SECONDARY'], isCoreTrade: true },
  { name: 'Horticulture and Crop Production', gradeTiers: ['SENIOR_SECONDARY'], isCoreTrade: true },

  // Science stream electives
  { name: 'Physics', gradeTiers: ['SENIOR_SECONDARY'], streams: ['SCIENCE'] },
  { name: 'Chemistry', gradeTiers: ['SENIOR_SECONDARY'], streams: ['SCIENCE'] },
  { name: 'Biology', gradeTiers: ['SENIOR_SECONDARY'], streams: ['SCIENCE'] },
  { name: 'Agricultural Science', gradeTiers: ['SENIOR_SECONDARY'], streams: ['SCIENCE'] },
  { name: 'Further Mathematics', gradeTiers: ['SENIOR_SECONDARY'], streams: ['SCIENCE'] },
  { name: 'Geography', gradeTiers: ['SENIOR_SECONDARY'], streams: ['SCIENCE'] },
  { name: 'Physical Education', gradeTiers: ['SENIOR_SECONDARY'], streams: ['SCIENCE'] },
  { name: 'Health Education', gradeTiers: ['SENIOR_SECONDARY'], streams: ['SCIENCE'] },
  { name: 'Food & Nutrition', gradeTiers: ['SENIOR_SECONDARY'], streams: ['SCIENCE'] },
  { name: 'Technical Drawing', gradeTiers: ['SENIOR_SECONDARY'], streams: ['SCIENCE'] },
  { name: 'Visual Arts', gradeTiers: ['SENIOR_SECONDARY'], streams: ['SCIENCE'] },

  // Art stream electives
  { name: 'History', gradeTiers: ['JUNIOR_SECONDARY', 'SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Government', gradeTiers: ['SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'French Language', gradeTiers: ['JUNIOR_SECONDARY', 'SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Literature in English', gradeTiers: ['SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Financial Accounting', gradeTiers: ['SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Economics', gradeTiers: ['SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Arabic Language', gradeTiers: ['UPPER_PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Christian Religious Studies', gradeTiers: ['SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Islamic Studies', gradeTiers: ['SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Hausa Language', gradeTiers: ['SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Igbo Language', gradeTiers: ['SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Yoruba Language', gradeTiers: ['SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Music', gradeTiers: ['SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Home Management', gradeTiers: ['SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Catering Craft', gradeTiers: ['SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Commerce', gradeTiers: ['SENIOR_SECONDARY'], streams: ['ART'] },
  { name: 'Marketing', gradeTiers: ['SENIOR_SECONDARY'], streams: ['ART'] },
];

// Replaced by the merged/renamed entries above. Deleted only when safe.
const SUPERSEDED_NAMES = ['Language', 'National Values Education', 'Religion'];

// Managed outside TARGET_SUBJECTS because it needs conditional narrowing,
// not a flat overwrite — see narrowCivicEducation below.
const OTHER_MANAGED_NAMES = ['Civic Education'];

/** "Citizenship and Heritage Studies" supersedes Civic Education at
 * Senior Secondary specifically; Civic Education stays valid at
 * Primary/JSS. Only drops SENIOR_SECONDARY from its gradeTiers if it has
 * zero results on record — same safety rule as SUPERSEDED_NAMES. */
async function narrowCivicEducation(tenantId: string) {
  const existing = await prisma.subject.findUnique({ where: { tenantId_name: { tenantId, name: 'Civic Education' } } });
  if (!existing) return;
  const resultCount = await prisma.result.count({ where: { subjectId: existing.id } });
  if (resultCount > 0) {
    console.log(`  NOTE: "Civic Education" has ${resultCount} result(s), leaving Senior Secondary in its grade bands`);
    return;
  }
  const gradeTiers: GradeTier[] = ['LOWER_PRIMARY', 'UPPER_PRIMARY', 'JUNIOR_SECONDARY'];
  await prisma.subject.update({ where: { id: existing.id }, data: { gradeTiers, streams: [] } });
  console.log('  updated "Civic Education" -> dropped Senior Secondary (superseded by "Citizenship and Heritage Studies")');
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });

  for (const tenant of tenants) {
    console.log(`\n== ${tenant.name} ==`);

    for (const name of SUPERSEDED_NAMES) {
      const existing = await prisma.subject.findUnique({ where: { tenantId_name: { tenantId: tenant.id, name } } });
      if (!existing) continue;
      const resultCount = await prisma.result.count({ where: { subjectId: existing.id } });
      if (resultCount > 0) {
        console.log(`  SKIP delete "${name}": ${resultCount} result(s) on record, keeping it as-is`);
        continue;
      }
      await prisma.teacherSubjectAssignment.deleteMany({ where: { subjectId: existing.id } });
      await prisma.subject.delete({ where: { id: existing.id } });
      console.log(`  deleted superseded subject "${name}"`);
    }

    await narrowCivicEducation(tenant.id);

    for (const target of TARGET_SUBJECTS) {
      const streams = target.streams ?? [];
      const isCompulsory = target.isCompulsory ?? false;
      const isCoreTrade = target.isCoreTrade ?? false;
      const existing = await prisma.subject.findUnique({ where: { tenantId_name: { tenantId: tenant.id, name: target.name } } });
      if (existing) {
        await prisma.subject.update({ where: { id: existing.id }, data: { gradeTiers: target.gradeTiers, streams, isCompulsory, isCoreTrade } });
        console.log(`  updated "${target.name}" -> [${target.gradeTiers.join(', ')}]${streams.length ? ` streams:[${streams.join(', ')}]` : ''}${isCompulsory ? ' (compulsory)' : ''}${isCoreTrade ? ' (core trade)' : ''}`);
      } else {
        await prisma.subject.create({ data: { tenantId: tenant.id, name: target.name, gradeTiers: target.gradeTiers, streams, isCompulsory, isCoreTrade } });
        console.log(`  created "${target.name}" -> [${target.gradeTiers.join(', ')}]${streams.length ? ` streams:[${streams.join(', ')}]` : ''}${isCompulsory ? ' (compulsory)' : ''}${isCoreTrade ? ' (core trade)' : ''}`);
      }
    }

    const resultBearingLeftovers = await prisma.subject.findMany({
      where: { tenantId: tenant.id, name: { notIn: [...TARGET_SUBJECTS.map((t) => t.name), ...SUPERSEDED_NAMES, ...OTHER_MANAGED_NAMES] } },
      select: { id: true, name: true },
    });
    for (const s of resultBearingLeftovers) {
      const resultCount = await prisma.result.count({ where: { subjectId: s.id } });
      if (resultCount > 0) console.log(`  NOTE: "${s.name}" isn't part of this curriculum list but has ${resultCount} result(s), left untouched`);
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
