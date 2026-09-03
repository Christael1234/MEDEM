import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
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

  create(dto: CreateGuardianDto) {
    return this.prisma.db.guardian.create({
      data: tenantScopedCreate({
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
      }),
    });
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
      include: { studentLinks: { include: { student: true } } },
    });
    return guardian?.studentLinks ?? [];
  }
}
