import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma, SchoolLevel, Stream } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  createSubject(dto: CreateSubjectDto) {
    return this.prisma.db.subject.create({
      data: tenantScopedCreate({ name: dto.name, code: dto.code, levels: dto.levels, streams: dto.streams ?? [] }),
    });
  }

  async updateSubject(id: string, dto: UpdateSubjectDto) {
    const before = await this.prisma.db.subject.findUniqueOrThrow({ where: { id } });
    const updated = await this.prisma.db.subject.update({
      where: { id },
      data: { name: dto.name ?? undefined, code: dto.code ?? undefined, levels: dto.levels ?? undefined, streams: dto.streams ?? undefined },
    });
    await this.audit.log({
      action: 'SUBJECT_UPDATED',
      entityType: 'Subject',
      entityId: id,
      before: { name: before.name, levels: before.levels, streams: before.streams },
      after: { name: updated.name, levels: updated.levels, streams: updated.streams },
    });
    return updated;
  }

  /** Optional level/stream filters — e.g. the class-detail "add/reassign
   * subject teacher" pickers ask for only the subjects taught at that
   * class's level; a Senior Secondary student's stream further narrows
   * which of those subjects apply to them. A subject with no streams
   * configured is "any stream", same convention as an empty `levels`. */
  listSubjects(level?: SchoolLevel, stream?: Stream) {
    return this.prisma.db.subject.findMany({
      where: {
        levels: level ? { has: level } : undefined,
        ...(stream ? { OR: [{ streams: { isEmpty: true } }, { streams: { has: stream } }] } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  /** A subject with no levels configured yet is treated as "any level" —
   * an empty array blocking every assignment would just make newly
   * created subjects unusable until someone remembers to tag them. */
  private async assertSubjectAppliesToClassLevel(subjectId: string, schoolClassId: string): Promise<void> {
    const [subject, schoolClass] = await Promise.all([
      this.prisma.db.subject.findUniqueOrThrow({ where: { id: subjectId } }),
      this.prisma.db.schoolClass.findUniqueOrThrow({ where: { id: schoolClassId } }),
    ]);
    if (subject.levels.length && !subject.levels.includes(schoolClass.level)) {
      throw new BadRequestException(`${subject.name} isn’t configured for ${schoolClass.level.replace('_', ' ').toLowerCase()} classes`);
    }
  }

  /** StaffProfile, SchoolClass and Subject are each tenant-scoped —
   * resolving all three through the scoped client confirms every id in
   * this cross-tenant-owned join row actually belongs to the caller's
   * tenant before the (unscoped) assignment row is created.
   *
   * The pre-check gives a clear, specific error in the normal case; the
   * catch is a backstop against the same race the schema's own
   * @@unique([staffProfileId, schoolClassId, subjectId]) guards against —
   * without it, a genuine race (or a client retry) would surface as a raw
   * 500 (Prisma P2002) instead of a clean 409. */
  async assignTeacher(dto: AssignTeacherDto) {
    await Promise.all([
      this.prisma.db.staffProfile.findUniqueOrThrow({ where: { id: dto.staffProfileId } }),
      this.prisma.db.schoolClass.findUniqueOrThrow({ where: { id: dto.schoolClassId } }),
      this.prisma.db.subject.findUniqueOrThrow({ where: { id: dto.subjectId } }),
    ]);
    await this.assertSubjectAppliesToClassLevel(dto.subjectId, dto.schoolClassId);

    const existing = await this.prisma.db.teacherSubjectAssignment.findUnique({
      where: {
        staffProfileId_schoolClassId_subjectId: {
          staffProfileId: dto.staffProfileId,
          schoolClassId: dto.schoolClassId,
          subjectId: dto.subjectId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('This teacher is already assigned to teach this subject in this class');
    }

    let created;
    try {
      created = await this.prisma.db.teacherSubjectAssignment.create({
        data: {
          staffProfileId: dto.staffProfileId,
          schoolClassId: dto.schoolClassId,
          subjectId: dto.subjectId,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('This teacher is already assigned to teach this subject in this class');
      }
      throw err;
    }

    await this.audit.log({
      action: 'TEACHER_SUBJECT_ASSIGNED',
      entityType: 'TeacherSubjectAssignment',
      entityId: created.id,
      after: { staffProfileId: dto.staffProfileId, schoolClassId: dto.schoolClassId, subjectId: dto.subjectId },
    });

    return created;
  }

  /** Replaces whichever teacher(s) currently hold this (class, subject)
   * pair with dto.staffProfileId — unlike assignTeacher (which is
   * additive, for legitimate co-teaching), this is the "swap the subject
   * teacher" action: the old assignment(s) are removed, not left dangling
   * alongside the new one. */
  async reassignTeacher(dto: AssignTeacherDto) {
    await Promise.all([
      this.prisma.db.staffProfile.findUniqueOrThrow({ where: { id: dto.staffProfileId } }),
      this.prisma.db.schoolClass.findUniqueOrThrow({ where: { id: dto.schoolClassId } }),
      this.prisma.db.subject.findUniqueOrThrow({ where: { id: dto.subjectId } }),
    ]);
    await this.assertSubjectAppliesToClassLevel(dto.subjectId, dto.schoolClassId);

    const existing = await this.prisma.db.teacherSubjectAssignment.findMany({
      where: { schoolClassId: dto.schoolClassId, subjectId: dto.subjectId },
    });

    if (existing.some((a) => a.staffProfileId === dto.staffProfileId)) {
      throw new ConflictException('This teacher already teaches this subject in this class');
    }

    await this.prisma.db.teacherSubjectAssignment.deleteMany({
      where: { schoolClassId: dto.schoolClassId, subjectId: dto.subjectId },
    });
    const created = await this.prisma.db.teacherSubjectAssignment.create({
      data: { staffProfileId: dto.staffProfileId, schoolClassId: dto.schoolClassId, subjectId: dto.subjectId },
    });

    for (const old of existing) {
      await this.audit.log({
        action: 'TEACHER_SUBJECT_UNASSIGNED',
        entityType: 'TeacherSubjectAssignment',
        entityId: old.id,
        before: { staffProfileId: old.staffProfileId, schoolClassId: old.schoolClassId, subjectId: old.subjectId },
      });
    }
    await this.audit.log({
      action: 'TEACHER_SUBJECT_ASSIGNED',
      entityType: 'TeacherSubjectAssignment',
      entityId: created.id,
      after: { staffProfileId: created.staffProfileId, schoolClassId: created.schoolClassId, subjectId: created.subjectId },
    });

    return created;
  }

  listAssignmentsForClass(schoolClassId: string) {
    return this.prisma.db.teacherSubjectAssignment.findMany({
      where: { schoolClassId },
      include: { subject: true, staffProfile: true },
    });
  }

  listAssignmentsForStaff(staffProfileId: string) {
    return this.prisma.db.teacherSubjectAssignment.findMany({
      where: { staffProfileId },
      include: { subject: true, schoolClass: true },
    });
  }

  /** TeacherSubjectAssignment isn't auto-tenant-scoped (one hop away —
   * same doc comment as ClassArm in tenant-scoping.extension.ts).
   * Resolving its staffProfileId through the scoped client confirms this
   * row actually belongs to the caller's tenant before deleting it — a
   * bare findUnique/delete by raw id would let a caller delete any
   * tenant's assignment row by guessing an id. */
  async removeAssignment(id: string) {
    const existing = await this.prisma.db.teacherSubjectAssignment.findUniqueOrThrow({ where: { id } });
    await this.prisma.db.staffProfile.findUniqueOrThrow({ where: { id: existing.staffProfileId } });

    await this.prisma.db.teacherSubjectAssignment.delete({ where: { id } });

    await this.audit.log({
      action: 'TEACHER_SUBJECT_UNASSIGNED',
      entityType: 'TeacherSubjectAssignment',
      entityId: id,
      before: {
        staffProfileId: existing.staffProfileId,
        schoolClassId: existing.schoolClassId,
        subjectId: existing.subjectId,
      },
    });
  }
}
