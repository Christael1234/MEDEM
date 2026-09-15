import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { GradeTier, Prisma, Stream } from '@prisma/client';
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

  /** A Senior Secondary subject that's neither compulsory nor a core
   * trade subject must declare its stream(s): that's what a student's
   * elective picker (StudentsService.getSubjectOptions) filters on, so an
   * unstreamed "regular" SS subject would be unreachable by any student. */
  private assertStreamRequirement(gradeTiers: GradeTier[], streams: Stream[], isCompulsory: boolean, isCoreTrade: boolean, name: string): void {
    if (isCompulsory && isCoreTrade) {
      throw new BadRequestException(`${name} can't be both compulsory and a core trade subject`);
    }
    if (gradeTiers.includes('SENIOR_SECONDARY') && !isCompulsory && !isCoreTrade && !streams.length) {
      throw new BadRequestException(`${name} needs at least one stream (Science or Art) — only compulsory and core trade subjects can skip this`);
    }
  }

  createSubject(dto: CreateSubjectDto) {
    const streams = dto.streams ?? [];
    const isCompulsory = dto.isCompulsory ?? false;
    const isCoreTrade = dto.isCoreTrade ?? false;
    this.assertStreamRequirement(dto.gradeTiers, streams, isCompulsory, isCoreTrade, dto.name);
    return this.prisma.db.subject.create({
      data: tenantScopedCreate({ name: dto.name, code: dto.code, gradeTiers: dto.gradeTiers, streams, isCompulsory, isCoreTrade }),
    });
  }

  async updateSubject(id: string, dto: UpdateSubjectDto) {
    const before = await this.prisma.db.subject.findUniqueOrThrow({ where: { id } });
    const gradeTiers = dto.gradeTiers ?? before.gradeTiers;
    const streams = dto.streams ?? before.streams;
    const isCompulsory = dto.isCompulsory ?? before.isCompulsory;
    const isCoreTrade = dto.isCoreTrade ?? before.isCoreTrade;
    this.assertStreamRequirement(gradeTiers, streams, isCompulsory, isCoreTrade, dto.name ?? before.name);

    const updated = await this.prisma.db.subject.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        code: dto.code ?? undefined,
        gradeTiers: dto.gradeTiers ?? undefined,
        streams: dto.streams ?? undefined,
        isCompulsory: dto.isCompulsory ?? undefined,
        isCoreTrade: dto.isCoreTrade ?? undefined,
      },
    });
    await this.audit.log({
      action: 'SUBJECT_UPDATED',
      entityType: 'Subject',
      entityId: id,
      before: { name: before.name, gradeTiers: before.gradeTiers, streams: before.streams, isCompulsory: before.isCompulsory, isCoreTrade: before.isCoreTrade },
      after: { name: updated.name, gradeTiers: updated.gradeTiers, streams: updated.streams, isCompulsory: updated.isCompulsory, isCoreTrade: updated.isCoreTrade },
    });
    return updated;
  }

  /** Results are ledger-like (CLAUDE.md): a subject that already has any
   * (draft or published) results attached can't be deleted out from under
   * them — that would cascade-delete real academic records. Teacher
   * assignments aren't historical in the same way, so those are removed
   * (with their own audit trail, same as removeAssignment) before the
   * subject itself goes. */
  async deleteSubject(id: string) {
    const subject = await this.prisma.db.subject.findUniqueOrThrow({ where: { id } });

    const resultCount = await this.prisma.db.result.count({ where: { subjectId: id } });
    if (resultCount > 0) {
      throw new ConflictException(`${subject.name} has existing results and can't be deleted`);
    }

    const assignments = await this.prisma.db.teacherSubjectAssignment.findMany({ where: { subjectId: id } });
    await this.prisma.db.teacherSubjectAssignment.deleteMany({ where: { subjectId: id } });
    for (const a of assignments) {
      await this.audit.log({
        action: 'TEACHER_SUBJECT_UNASSIGNED',
        entityType: 'TeacherSubjectAssignment',
        entityId: a.id,
        before: { staffProfileId: a.staffProfileId, schoolClassId: a.schoolClassId, subjectId: a.subjectId },
      });
    }

    await this.prisma.db.subject.delete({ where: { id } });
    await this.audit.log({
      action: 'SUBJECT_DELETED',
      entityType: 'Subject',
      entityId: id,
      before: { name: subject.name, gradeTiers: subject.gradeTiers, streams: subject.streams },
    });
  }

  /** Optional gradeTier/stream filters, e.g. the class-detail "add/reassign
   * subject teacher" pickers ask for only the subjects taught at that
   * class's grade tier; a Senior Secondary student's stream further narrows
   * which of those subjects apply to them. A subject with no streams
   * configured is "any stream", same convention as an empty `gradeTiers`. */
  listSubjects(gradeTier?: GradeTier, stream?: Stream) {
    return this.prisma.db.subject.findMany({
      where: {
        gradeTiers: gradeTier ? { has: gradeTier } : undefined,
        ...(stream ? { OR: [{ streams: { isEmpty: true } }, { streams: { has: stream } }] } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  /** A subject with no gradeTiers configured yet is treated as "any grade
   * tier": an empty array blocking every assignment would just make newly
   * created subjects unusable until someone remembers to tag them. */
  private async assertSubjectAppliesToClassLevel(subjectId: string, schoolClassId: string): Promise<void> {
    const [subject, schoolClass] = await Promise.all([
      this.prisma.db.subject.findUniqueOrThrow({ where: { id: subjectId } }),
      this.prisma.db.schoolClass.findUniqueOrThrow({ where: { id: schoolClassId } }),
    ]);
    if (subject.gradeTiers.length && !subject.gradeTiers.includes(schoolClass.gradeTier)) {
      throw new BadRequestException(`${subject.name} isn’t configured for ${schoolClass.gradeTier.replace('_', ' ').toLowerCase()} classes`);
    }
  }

  /** StaffProfile, SchoolClass and Subject are each tenant-scoped:
   * resolving all three through the scoped client confirms every id in
   * this cross-tenant-owned join row actually belongs to the caller's
   * tenant before the (unscoped) assignment row is created.
   *
   * The pre-check gives a clear, specific error in the normal case; the
   * catch is a backstop against the same race the schema's own
   * @@unique([staffProfileId, schoolClassId, subjectId]) guards against,
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
   * pair with dto.staffProfileId. Unlike assignTeacher (which is
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

  /** TeacherSubjectAssignment isn't auto-tenant-scoped (one hop away,
   * same doc comment as ClassArm in tenant-scoping.extension.ts).
   * Resolving its staffProfileId through the scoped client confirms this
   * row actually belongs to the caller's tenant before deleting it: a
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
