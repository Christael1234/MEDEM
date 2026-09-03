import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { CreateAcademicSessionDto } from './dto/create-academic-session.dto';
import { CreateTermDto } from './dto/create-term.dto';

@Injectable()
export class AcademicSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  createSession(dto: CreateAcademicSessionDto) {
    return this.prisma.db.academicSession.create({
      data: tenantScopedCreate({
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isCurrent: dto.isCurrent ?? false,
      }),
    });
  }

  listSessions() {
    return this.prisma.db.academicSession.findMany({
      orderBy: { startDate: 'desc' },
      include: { terms: true },
    });
  }

  /** Term has no tenantId column and isn't auto-scoped by the Prisma
   * extension — ownership is enforced here by requiring the parent
   * AcademicSession to resolve through the tenant-scoped client first. */
  async createTerm(dto: CreateTermDto) {
    await this.prisma.db.academicSession.findUniqueOrThrow({
      where: { id: dto.academicSessionId },
    });

    return this.prisma.db.term.create({
      data: {
        academicSessionId: dto.academicSessionId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isCurrent: dto.isCurrent ?? false,
      },
    });
  }

  async listTerms(academicSessionId: string) {
    await this.prisma.db.academicSession.findUniqueOrThrow({
      where: { id: academicSessionId },
    });
    return this.prisma.db.term.findMany({
      where: { academicSessionId },
      orderBy: { startDate: 'asc' },
    });
  }

  /** Same pattern as ClassesService.assertArmBelongsToTenant — Term has
   * no tenantId of its own, so ownership is proven via its tenant-scoped
   * parent AcademicSession. */
  async assertTermBelongsToTenant(termId: string): Promise<void> {
    await this.prisma.db.academicSession.findFirstOrThrow({
      where: { terms: { some: { id: termId } } },
    });
  }
}
