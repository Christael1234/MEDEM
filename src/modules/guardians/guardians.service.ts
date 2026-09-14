import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { DEFAULT_PORTAL_PASSWORD, generateLoginEmail } from '../../common/auth/login-credentials';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { LinkGuardianDto } from './dto/link-guardian.dto';

@Injectable()
export class GuardiansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly requestContext: RequestContextService,
  ) {}

  /** Backs the "search existing parent" picker on student creation — e.g.
   * finding a sibling's parent already on file instead of creating a
   * duplicate guardian record for the same person. Requires a real query;
   * an empty/near-empty one intentionally returns nothing rather than the
   * whole guardian list. */
  search(query?: string) {
    const q = (query ?? '').trim();
    if (q.length < 2) return [];
    return this.prisma.db.guardian.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ],
      },
      orderBy: { lastName: 'asc' },
      take: 10,
    });
  }

  /** Creates a real portal login alongside the Guardian profile — same
   * pattern as StaffProfilesService.createTeacher / StudentsService.create,
   * so a parent added by the school can sign in immediately rather than
   * needing a separate account-provisioning step. */
  async create(dto: CreateGuardianDto) {
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId) throw new ForbiddenException();

    const loginEmail = await generateLoginEmail(this.prisma, tenantId, dto.firstName, dto.lastName, 'parent');
    const passwordHash = await bcrypt.hash(DEFAULT_PORTAL_PASSWORD, 12);

    const { guardian, user } = await this.prisma.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { role: 'PARENT', email: loginEmail, passwordHash, firstName: dto.firstName, lastName: dto.lastName },
      });
      const guardian = await tx.guardian.create({
        data: tenantScopedCreate({
          userId: user.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          address: dto.address,
        }),
      });
      return { guardian, user };
    });

    await this.audit.log({
      action: 'GUARDIAN_CREATED',
      entityType: 'Guardian',
      entityId: guardian.id,
      after: { loginEmail: user.email },
    });

    return { ...guardian, loginCredentials: { email: user.email, password: DEFAULT_PORTAL_PASSWORD } };
  }

  async link(dto: LinkGuardianDto) {
    // Both sides are tenant-scoped models — resolving them confirms
    // neither id belongs to another tenant before the join row is made.
    await this.prisma.db.student.findUniqueOrThrow({ where: { id: dto.studentId } });
    await this.prisma.db.guardian.findUniqueOrThrow({ where: { id: dto.guardianId } });

    const link = await this.prisma.db.studentGuardian.create({
      data: {
        studentId: dto.studentId,
        guardianId: dto.guardianId,
        relationship: dto.relationship,
        isPrimary: dto.isPrimary ?? false,
      },
    });

    await this.audit.log({
      action: 'GUARDIAN_LINKED',
      entityType: 'Student',
      entityId: dto.studentId,
      after: { guardianId: dto.guardianId, relationship: dto.relationship },
    });

    return link;
  }

  listForStudent(studentId: string) {
    return this.prisma.db.studentGuardian.findMany({
      where: { studentId },
      include: { guardian: true },
    });
  }

  async myChildren() {
    const userId = this.requestContext.getUserId();
    if (!userId) throw new NotFoundException();

    const guardian = await this.prisma.db.guardian.findFirst({
      where: { userId },
      include: {
        studentLinks: {
          include: {
            student: {
              include: { currentClassArm: { include: { schoolClass: { select: { name: true } } } } },
            },
          },
        },
      },
    });
    return guardian?.studentLinks ?? [];
  }
}
