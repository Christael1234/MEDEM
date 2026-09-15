import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ClassesService } from '../classes/classes.service';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { UpdateTimetableSettingsDto } from './dto/update-timetable-settings.dto';
import { TIMETABLE_DAYS, DEFAULT_DAY_START_TIME, DEFAULT_DAY_END_TIME, buildPeriods, TimetablePeriod } from './timetable-schedule';
import { distributePeriodsPerWeek, scheduleAllArms } from './timetable-generator';

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly requestContext: RequestContextService,
    private readonly audit: AuditService,
  ) {}

  /** Lazily creates the tenant's settings row with sensible defaults on
   * first read: no separate seed step needed, and every tenant that's
   * never touched timetable settings still gets a working default day. */
  async getSettings() {
    let settings = await this.prisma.db.timetableSettings.findFirst({
      include: { breaks: { orderBy: { startTime: 'asc' } } },
    });
    if (!settings) {
      settings = await this.prisma.db.timetableSettings.create({
        data: tenantScopedCreate({ dayStartTime: DEFAULT_DAY_START_TIME, dayEndTime: DEFAULT_DAY_END_TIME }),
        include: { breaks: { orderBy: { startTime: 'asc' } } },
      });
    }
    return settings;
  }

  /** Admin sets break windows (and optionally the day's start/end) BEFORE
   * generating. Generate always rebuilds the whole timetable from
   * whatever settings are current, so this has to happen first for the
   * breaks to actually apply. */
  async updateSettings(dto: UpdateTimetableSettingsDto) {
    const current = await this.getSettings();
    const dayStartTime = dto.dayStartTime ?? current.dayStartTime;
    const dayEndTime = dto.dayEndTime ?? current.dayEndTime;
    if (dayStartTime >= dayEndTime) {
      throw new BadRequestException('dayStartTime must be before dayEndTime');
    }
    if (dto.breaks) {
      for (const b of dto.breaks) {
        if (b.startTime >= b.endTime) {
          throw new BadRequestException(`Break "${b.label}" must start before it ends`);
        }
        if (b.startTime < dayStartTime || b.endTime > dayEndTime) {
          throw new BadRequestException(`Break "${b.label}" must fall within the school day (${dayStartTime}–${dayEndTime})`);
        }
      }
    }

    await this.prisma.db.$transaction(async (tx) => {
      await tx.timetableSettings.update({
        where: { id: current.id },
        data: { dayStartTime, dayEndTime },
      });
      if (dto.breaks) {
        await tx.timetableBreak.deleteMany({ where: { timetableSettingsId: current.id } });
        if (dto.breaks.length) {
          await tx.timetableBreak.createMany({
            data: dto.breaks.map((b, i) => ({
              timetableSettingsId: current.id,
              label: b.label,
              startTime: b.startTime,
              endTime: b.endTime,
              order: i,
            })),
          });
        }
      }
    });

    await this.audit.log({
      action: 'TIMETABLE_SETTINGS_UPDATED',
      entityType: 'TimetableSettings',
      entityId: current.id,
      before: { dayStartTime: current.dayStartTime, dayEndTime: current.dayEndTime, breaks: current.breaks },
      after: { dayStartTime, dayEndTime, breaks: dto.breaks ?? current.breaks },
    });

    return this.getSettings();
  }

  /**
   * Regenerates the whole tenant's timetable from current
   * TeacherSubjectAssignment data and the current TimetableSettings. Wipes
   * every existing slot for the tenant first: a timetable is a derived
   * artifact, not something hand-edited into a state the generator
   * wouldn't produce, so "regenerate" means "recompute from scratch", not
   * "merge".
   *
   * A Nursery class's day is sized to its own subject count (one period
   * per subject per day, every day) rather than stretched across the
   * full Junior/Senior day the way a class with a dozen subjects needs;
   * see `periodsForClass` below. Every other level uses the full day.
   */
  async generate() {
    const settings = await this.getSettings();
    const fullDayPeriods = buildPeriods(settings.dayStartTime, settings.dayEndTime, settings.breaks);
    if (!fullDayPeriods.length) {
      throw new BadRequestException('The configured school day has no schedulable periods: check Timetable Settings (day start/end and breaks)');
    }
    const periodTimesByIndex = new Map(fullDayPeriods.map((p) => [p.index, p]));

    const schoolClasses = await this.prisma.db.schoolClass.findMany({
      include: {
        arms: { select: { id: true, name: true } },
        teacherAssignments: { select: { subjectId: true, staffProfileId: true, subject: { select: { name: true } } } },
      },
    });

    const unitsByArm = new Map<string, { subjectId: string; staffProfileId: string }[]>();
    const periodsByArm = new Map<string, TimetablePeriod[]>();
    const skipped: { armId: string; armName: string; className: string; reason: string }[] = [];

    for (const sc of schoolClasses) {
      if (!sc.teacherAssignments.length) {
        sc.arms.forEach((a) => skipped.push({ armId: a.id, armName: a.name, className: sc.name, reason: 'No subject teachers assigned to this class yet' }));
        continue;
      }

      const distinctSubjectCount = new Set(sc.teacherAssignments.map((a) => a.subjectId)).size;
      const periodsForClass = sc.level === 'NURSERY'
        ? fullDayPeriods.slice(0, Math.max(1, Math.min(distinctSubjectCount, fullDayPeriods.length)))
        : fullDayPeriods;
      const slotsPerWeek = periodsForClass.length * TIMETABLE_DAYS.length;

      const withCounts = distributePeriodsPerWeek(sc.teacherAssignments, slotsPerWeek);
      for (const arm of sc.arms) {
        const units: { subjectId: string; staffProfileId: string }[] = [];
        withCounts.forEach((a) => {
          for (let i = 0; i < a.periodsPerWeek; i++) units.push({ subjectId: a.subjectId, staffProfileId: a.staffProfileId });
        });
        unitsByArm.set(arm.id, units);
        periodsByArm.set(arm.id, periodsForClass);
      }
    }

    const outcomes = scheduleAllArms(unitsByArm, periodsByArm, TIMETABLE_DAYS);

    const rows = outcomes.flatMap((o) =>
      o.placed.map((p) => {
        const period = periodTimesByIndex.get(p.periodIndex)!;
        return tenantScopedCreate({
          classArmId: p.armId,
          subjectId: p.subjectId,
          staffProfileId: p.staffProfileId,
          dayOfWeek: p.dayOfWeek,
          periodIndex: p.periodIndex,
          startTime: period.startTime,
          endTime: period.endTime,
        });
      }),
    );

    const armNameById = new Map(schoolClasses.flatMap((sc) => sc.arms.map((a) => [a.id, { armName: a.name, className: sc.name }])));
    const conflicts = outcomes
      .filter((o) => o.unplacedCount > 0)
      .map((o) => ({ armId: o.armId, ...armNameById.get(o.armId)!, reason: 'Could not find a conflict-free schedule: likely a teacher is overloaded across too many classes' }));

    await this.prisma.db.$transaction(async (tx) => {
      await tx.timetableSlot.deleteMany({});
      if (rows.length) await tx.timetableSlot.createMany({ data: rows });
    });

    await this.audit.log({
      action: 'TIMETABLE_GENERATED',
      entityType: 'TimetableSlot',
      entityId: 'tenant-wide',
      after: { slotsCreated: rows.length, armsScheduled: outcomes.length - conflicts.length, armsSkipped: skipped.length, armsWithConflicts: conflicts.length },
    });

    return {
      slotsCreated: rows.length,
      armsScheduled: outcomes.length - conflicts.length,
      armsSkipped: skipped,
      armsWithConflicts: conflicts,
      days: TIMETABLE_DAYS,
      periods: fullDayPeriods,
      breaks: settings.breaks,
    };
  }

  async getForClassArm(classArmId: string) {
    await this.assertReadAccess(classArmId);
    return this.gridForArm(classArmId);
  }

  private async gridForArm(classArmId: string) {
    const [arm, settings] = await Promise.all([
      this.prisma.db.classArm.findUniqueOrThrow({
        where: { id: classArmId },
        select: { name: true, schoolClass: { select: { name: true } } },
      }),
      this.getSettings(),
    ]);
    const slots = await this.prisma.db.timetableSlot.findMany({
      where: { classArmId },
      include: {
        subject: { select: { name: true } },
        staffProfile: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodIndex: 'asc' }],
    });
    return {
      classArmId,
      className: arm.schoolClass.name,
      armName: arm.name,
      days: TIMETABLE_DAYS,
      periods: buildPeriods(settings.dayStartTime, settings.dayEndTime, settings.breaks),
      breaks: settings.breaks,
      slots: slots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        periodIndex: s.periodIndex,
        startTime: s.startTime,
        endTime: s.endTime,
        subjectId: s.subjectId,
        subjectName: s.subject.name,
        staffProfileId: s.staffProfileId,
        teacherName: `${s.staffProfile.user.firstName} ${s.staffProfile.user.lastName}`,
      })),
    };
  }

  /** For the TEACHER portal: every period they teach, across every class
   * arm, in one flat weekly list (not one grid per arm, since a teacher's
   * own view is "where am I, when", not "what does this class see"). */
  async getForCurrentTeacher() {
    const userId = this.requestContext.getUserId();
    const staffProfile = await this.prisma.db.staffProfile.findUnique({ where: { userId }, select: { id: true } });
    const settings = await this.getSettings();
    const periods = buildPeriods(settings.dayStartTime, settings.dayEndTime, settings.breaks);
    if (!staffProfile) return { slots: [], days: TIMETABLE_DAYS, periods, breaks: settings.breaks };
    return this.slotsForTeacher(staffProfile.id, periods, settings.breaks);
  }

  private async slotsForTeacher(staffProfileId: string, periods: TimetablePeriod[], breaks: { label: string; startTime: string; endTime: string }[]) {
    const slots = await this.prisma.db.timetableSlot.findMany({
      where: { staffProfileId },
      include: {
        subject: { select: { name: true } },
        classArm: { select: { name: true, schoolClass: { select: { name: true } } } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodIndex: 'asc' }],
    });
    return {
      days: TIMETABLE_DAYS,
      periods,
      breaks,
      slots: slots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        periodIndex: s.periodIndex,
        startTime: s.startTime,
        endTime: s.endTime,
        subjectName: s.subject.name,
        className: s.classArm.schoolClass.name,
        armName: s.classArm.name,
      })),
    };
  }

  /** For the STUDENT portal: their own class arm's grid. */
  async getForCurrentStudent() {
    const userId = this.requestContext.getUserId();
    const student = await this.prisma.db.student.findUniqueOrThrow({ where: { userId }, select: { currentClassArmId: true } });
    if (!student.currentClassArmId) {
      const settings = await this.getSettings();
      return { slots: [], days: TIMETABLE_DAYS, periods: buildPeriods(settings.dayStartTime, settings.dayEndTime, settings.breaks), breaks: settings.breaks };
    }
    return this.gridForArm(student.currentClassArmId);
  }

  /** For the PARENT portal: a specific linked child's grid. Caller
   * (ParentPortalController) verifies the studentId belongs to this parent
   * before calling this, same pattern as childAssignments/childResults. */
  async getForStudent(studentId: string) {
    const student = await this.prisma.db.student.findUniqueOrThrow({ where: { id: studentId }, select: { currentClassArmId: true } });
    if (!student.currentClassArmId) {
      const settings = await this.getSettings();
      return { slots: [], days: TIMETABLE_DAYS, periods: buildPeriods(settings.dayStartTime, settings.dayEndTime, settings.breaks), breaks: settings.breaks };
    }
    return this.gridForArm(student.currentClassArmId);
  }

  private async assertReadAccess(classArmId: string): Promise<void> {
    const role = this.requestContext.getRole();

    if (role === 'TEACHER') {
      await this.classes.assertTeacherCanActOnArm(classArmId);
      return;
    }
    if (role === 'STUDENT') {
      const userId = this.requestContext.getUserId();
      const student = await this.prisma.db.student.findFirst({ where: { userId }, select: { currentClassArmId: true } });
      if (!student || student.currentClassArmId !== classArmId) throw new ForbiddenException('No access to this class’s timetable');
      return;
    }
    if (role === 'PARENT') {
      const userId = this.requestContext.getUserId();
      const guardian = await this.prisma.db.guardian.findFirst({
        where: { userId },
        select: { studentLinks: { select: { student: { select: { currentClassArmId: true } } } } },
      });
      const hasChildInClass = guardian?.studentLinks.some((link) => link.student.currentClassArmId === classArmId);
      if (!hasChildInClass) throw new ForbiddenException('No access to this class’s timetable');
      return;
    }

    // PROPRIETOR / PRINCIPAL / other staff: tenant ownership is the only check.
    await this.classes.assertArmBelongsToTenant(classArmId);
  }
}
