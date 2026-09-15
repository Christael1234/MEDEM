import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { CreateAcademicSessionDto } from './dto/create-academic-session.dto';
import { CreateTermDto } from './dto/create-term.dto';

@Injectable()
export class AcademicSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly requestContext: RequestContextService,
  ) {}

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
   * extension; ownership is enforced here by requiring the parent
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

  /** Same pattern as ClassesService.assertArmBelongsToTenant: Term has
   * no tenantId of its own, so ownership is proven via its tenant-scoped
   * parent AcademicSession. */
  async assertTermBelongsToTenant(termId: string): Promise<void> {
    await this.prisma.db.academicSession.findFirstOrThrow({
      where: { terms: { some: { id: termId } } },
    });
  }

  /** Whichever Term has isCurrent = true, scoped to the caller's tenant by
   * querying through the tenant-scoped AcademicSession parent first (Term
   * itself has no tenantId and isn't auto-scoped, same pattern as
   * assertTermBelongsToTenant). */
  async getCurrentTerm() {
    const session = await this.prisma.db.academicSession.findFirst({
      where: { terms: { some: { isCurrent: true } } },
      include: { terms: { where: { isCurrent: true } } },
    });
    return session?.terms[0] ?? null;
  }

  /** End-of-session student promotion only makes sense once the school is
   * actually in its last term: gates StudentsService's bulk promotion so
   * it can't be run mid-year by mistake. */
  async assertCurrentTermIsThird(): Promise<void> {
    const current = await this.getCurrentTerm();
    if (!current || current.name !== 'THIRD') {
      throw new ForbiddenException('Promotion can only run during Third Term, once the current term is marked as such.');
    }
  }

  /** The tenant's current AcademicSession, or null if none is marked
   * current yet (e.g. a brand-new tenant that hasn't activated one). */
  getCurrentSession() {
    return this.prisma.db.academicSession.findFirst({ where: { isCurrent: true } });
  }

  /** Marks one Term as "current", and its parent AcademicSession along
   * with it, unsetting every other term/session for the tenant first.
   * This is the one write path that ever flips isCurrent, so both the
   * "advance to next term" and "start new session" UI actions reduce to
   * a single call here rather than each hand-rolling the unset/set pair.
   * Term has no tenantId of its own; ownership is proven via
   * assertTermBelongsToTenant before anything is written, same pattern
   * as every other Term-touching method in this service. */
  async activateTerm(termId: string) {
    await this.assertTermBelongsToTenant(termId);
    const term = await this.prisma.db.term.findUniqueOrThrow({ where: { id: termId } });
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId) throw new ForbiddenException('No tenant context');

    await this.prisma.db.$transaction([
      this.prisma.db.term.updateMany({
        where: { isCurrent: true, academicSession: { tenantId } },
        data: { isCurrent: false },
      }),
      this.prisma.db.academicSession.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      }),
      this.prisma.db.academicSession.update({
        where: { id: term.academicSessionId },
        data: { isCurrent: true },
      }),
      this.prisma.db.term.update({
        where: { id: termId },
        data: { isCurrent: true },
      }),
    ]);

    await this.audit.log({
      action: 'TERM_ACTIVATED',
      entityType: 'Term',
      entityId: termId,
      after: { termId, academicSessionId: term.academicSessionId, termName: term.name },
    });

    return this.prisma.db.term.findUniqueOrThrow({
      where: { id: termId },
      include: { academicSession: true },
    });
  }
}
