import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AcademicSessionsService } from '../academic-sessions/academic-sessions.service';
import { AuditService } from '../audit/audit.service';
import { ClassesService } from '../classes/classes.service';
import { StudentsService } from '../students/students.service';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { UpdateTimetableSettingsDto } from './dto/update-timetable-settings.dto';
import { UpdateTimetableSlotDto } from './dto/update-timetable-slot.dto';
import { TIMETABLE_DAYS, DEFAULT_DAY_START_TIME, DEFAULT_DAY_END_TIME, buildPeriods, TimetablePeriod } from './timetable-schedule';
import { BlockGroup, distributePeriodsPerWeek, scheduleAllArms } from './timetable-generator';

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly requestContext: RequestContextService,
    private readonly audit: AuditService,
    private readonly students: StudentsService,
    private readonly academicSessions: AcademicSessionsService,
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
   * every existing slot for the tenant first — including any manual edits
   * made via createSlot/updateSlot/deleteSlot below: "regenerate" means
   * "recompute from scratch", not "merge". Individual slots are editable
   * for fine-tuning *after* a generate, not as a permanent alternative to
   * it — running generate again discards those edits along with
   * everything else.
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
        arms: { select: { id: true, name: true, stream: true } },
        teacherAssignments: {
          select: {
            subjectId: true,
            staffProfileId: true,
            subject: { select: { name: true, isCompulsory: true, isCoreTrade: true, streams: true } },
          },
        },
      },
    });

    const unitsByArm = new Map<string, { subjectId: string; staffProfileId: string }[]>();
    const blockGroupsByArm = new Map<string, BlockGroup[]>();
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

      for (const arm of sc.arms) {
        periodsByArm.set(arm.id, periodsForClass);

        // Senior Secondary arm with a stream tagged: compulsory AND
        // stream-matching elective subjects each keep their own exclusive
        // cells (a student only ever picks ONE trade subject, but 3-4
        // electives — if electives shared one block like Trade does, a
        // student's own several chosen electives would collide at the
        // same cell). Only core-trade subjects share one block of cells
        // (see scheduleBlockGroup): every trade option runs in parallel,
        // a student attends whichever one they picked, and since they
        // only ever pick one, no collision is possible there either. An
        // SS arm with no stream set (or any non-SS class) falls through
        // to the flat behavior below, unchanged.
        if (sc.level === 'SENIOR_SECONDARY' && arm.stream) {
          const compulsory = sc.teacherAssignments.filter((a) => a.subject.isCompulsory);
          const trade = sc.teacherAssignments.filter((a) => a.subject.isCoreTrade);
          const elective = sc.teacherAssignments.filter(
            (a) => !a.subject.isCompulsory && !a.subject.isCoreTrade && a.subject.streams.includes(arm.stream!),
          );
          const exclusiveAssignments = [...compulsory, ...elective];

          const distributionInput: { subjectId: string }[] = exclusiveAssignments.map((a) => ({ subjectId: a.subjectId }));
          if (trade.length) distributionInput.push({ subjectId: '~TRADE' });

          if (!distributionInput.length) {
            skipped.push({ armId: arm.id, armName: arm.name, className: sc.name, reason: 'No compulsory, trade, or stream-matching elective subjects assigned yet' });
            continue;
          }

          const withCounts = distributePeriodsPerWeek(distributionInput, slotsPerWeek);
          const periodsFor = (key: string) => withCounts.find((w) => w.subjectId === key)?.periodsPerWeek ?? 0;

          const units: { subjectId: string; staffProfileId: string }[] = [];
          exclusiveAssignments.forEach((a) => {
            const count = periodsFor(a.subjectId);
            for (let i = 0; i < count; i++) units.push({ subjectId: a.subjectId, staffProfileId: a.staffProfileId });
          });
          unitsByArm.set(arm.id, units);

          const groups: BlockGroup[] = [];
          if (trade.length) {
            groups.push({ label: 'Trade Period', members: trade.map((a) => ({ subjectId: a.subjectId, staffProfileId: a.staffProfileId })), periodsNeeded: periodsFor('~TRADE') });
          }
          blockGroupsByArm.set(arm.id, groups);
          continue;
        }

        const withCounts = distributePeriodsPerWeek(sc.teacherAssignments, slotsPerWeek);
        const units: { subjectId: string; staffProfileId: string }[] = [];
        withCounts.forEach((a) => {
          for (let i = 0; i < a.periodsPerWeek; i++) units.push({ subjectId: a.subjectId, staffProfileId: a.staffProfileId });
        });
        unitsByArm.set(arm.id, units);
      }
    }

    const outcomes = scheduleAllArms(unitsByArm, periodsByArm, TIMETABLE_DAYS, Date.now(), blockGroupsByArm);

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
      .filter((o) => o.unplacedCount > 0 || o.unplacedBlockGroups.length > 0)
      .map((o) => ({
        armId: o.armId,
        ...armNameById.get(o.armId)!,
        reason: o.unplacedBlockGroups.length
          ? `Could not find enough shared free periods for: ${o.unplacedBlockGroups.join(', ')} (likely a trade/elective teacher is overloaded across too many classes)`
          : 'Could not find a conflict-free schedule: likely a teacher is overloaded across too many classes',
      }));

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

  /** `studentId`, when given, personalizes a Senior Secondary student's
   * grid down to just the subjects they actually selected this session
   * (compulsory + trade + their own electives) — every other subject
   * taught to the arm (including every OTHER trade option, all sharing
   * the same Trade Period cells — see generate()) is hidden rather than
   * shown as an extra/competing slot. Every other level has no selection
   * concept, so their grid is never filtered. Only the student's own view
   * and a parent's child view pass `studentId`; admin/teacher grids stay
   * fully unfiltered (they need to see the whole arm/room). */
  private async gridForArm(classArmId: string, studentId?: string) {
    const [arm, settings] = await Promise.all([
      this.prisma.db.classArm.findUniqueOrThrow({
        where: { id: classArmId },
        select: { name: true, schoolClass: { select: { name: true, level: true } } },
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

    let visibleSlots = slots;
    if (studentId && arm.schoolClass.level === 'SENIOR_SECONDARY') {
      const currentSession = await this.academicSessions.getCurrentSession();
      const selection = currentSession ? await this.students.getSubjectSelection(studentId, currentSession.id) : [];
      const selectedSubjectIds = new Set(selection.map((s) => s.subjectId));
      visibleSlots = slots.filter((s) => selectedSubjectIds.has(s.subjectId));
    }

    return {
      classArmId,
      className: arm.schoolClass.name,
      armName: arm.name,
      days: TIMETABLE_DAYS,
      periods: buildPeriods(settings.dayStartTime, settings.dayEndTime, settings.breaks),
      breaks: settings.breaks,
      slots: visibleSlots.map((s) => ({
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

  /** For the STUDENT portal: their own class arm's grid, personalized to
   * their own subject selection (see gridForArm). */
  async getForCurrentStudent() {
    const userId = this.requestContext.getUserId();
    const student = await this.prisma.db.student.findUniqueOrThrow({ where: { userId }, select: { id: true, currentClassArmId: true } });
    if (!student.currentClassArmId) {
      const settings = await this.getSettings();
      return { slots: [], days: TIMETABLE_DAYS, periods: buildPeriods(settings.dayStartTime, settings.dayEndTime, settings.breaks), breaks: settings.breaks };
    }
    return this.gridForArm(student.currentClassArmId, student.id);
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
    return this.gridForArm(student.currentClassArmId, studentId);
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
