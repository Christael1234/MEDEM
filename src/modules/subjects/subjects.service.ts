import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  createSubject(dto: CreateSubjectDto) {
    return this.prisma.db.subject.create({
      data: tenantScopedCreate({ name: dto.name, code: dto.code }),
    });
  }

  listSubjects() {
    return this.prisma.db.subject.findMany({ orderBy: { name: 'asc' } });
  }

  /** StaffProfile, SchoolClass and Subject are each tenant-scoped —
   * resolving all three through the scoped client confirms every id in
   * this cross-tenant-owned join row actually belongs to the caller's
   * tenant before the (unscoped) assignment row is created. */
  async assignTeacher(dto: AssignTeacherDto) {
    await Promise.all([
      this.prisma.db.staffProfile.findUniqueOrThrow({ where: { id: dto.staffProfileId } }),
      this.prisma.db.schoolClass.findUniqueOrThrow({ where: { id: dto.schoolClassId } }),
      this.prisma.db.subject.findUniqueOrThrow({ where: { id: dto.subjectId } }),
    ]);

    return this.prisma.db.teacherSubjectAssignment.create({
      data: {
        staffProfileId: dto.staffProfileId,
        schoolClassId: dto.schoolClassId,
        subjectId: dto.subjectId,
      },
    });
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
}
