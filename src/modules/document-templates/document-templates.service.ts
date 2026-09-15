import { ForbiddenException, Injectable } from '@nestjs/common';
import { AcademicSessionsService } from '../academic-sessions/academic-sessions.service';
import { AuditService } from '../audit/audit.service';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';

/** The four standard documents every school needs, seeded lazily (see
 * list()) rather than via a separate seed script, same pattern as
 * TimetableService.getSettings — a brand-new tenant gets sensible
 * starter content on first visit instead of an empty table. */
const DEFAULT_TEMPLATES: Array<{ key: string; name: string; content: string; mergeFields: string[] }> = [
  {
    key: 'REPORT_CARD',
    name: 'Report card',
    content:
      '{{school.name}}\nReport Card — {{term.name}} Term, {{session.name}}\n\nStudent: {{student.name}}\nClass: {{student.class}}\nAdmission No: {{student.admissionNo}}\n\nSubjects:\n{{subject.scores}}\n\nPrincipal: {{school.principalName}}',
    mergeFields: ['{{school.name}}', '{{school.principalName}}', '{{term.name}}', '{{session.name}}', '{{student.name}}', '{{student.class}}', '{{student.admissionNo}}', '{{subject.scores}}'],
  },
  {
    key: 'FEE_INVOICE',
    name: 'Fee bill / invoice',
    content:
      '{{school.name}}\nInvoice #{{invoice.number}}\n\nBilled to: {{student.name}} ({{student.class}})\n\n{{invoice.items}}\n\nTotal due: {{invoice.total}}\nDue date: {{invoice.dueDate}}',
    mergeFields: ['{{school.name}}', '{{student.name}}', '{{student.class}}', '{{invoice.number}}', '{{invoice.items}}', '{{invoice.total}}', '{{invoice.dueDate}}'],
  },
  {
    key: 'PAYMENT_RECEIPT',
    name: 'Payment receipt',
    content:
      '{{school.name}}\nReceipt #{{receipt.number}}\n\nReceived from: {{student.name}}\nAmount: {{payment.amount}}\nMethod: {{payment.method}}\nDate: {{payment.date}}',
    mergeFields: ['{{school.name}}', '{{student.name}}', '{{receipt.number}}', '{{payment.amount}}', '{{payment.method}}', '{{payment.date}}'],
  },
  {
    key: 'ADMISSION_LETTER',
    name: 'Admission letter',
    content:
      'Dear {{applicant.name}},\n\nWe are pleased to offer you admission into {{applicant.class}} at {{school.name}} for the {{term.name}} term.\n\nWarm regards,\n{{school.principalName}}',
    mergeFields: ['{{applicant.name}}', '{{applicant.class}}', '{{school.name}}', '{{term.name}}', '{{school.principalName}}'],
  },
];

@Injectable()
export class DocumentTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly audit: AuditService,
    private readonly academicSessions: AcademicSessionsService,
  ) {}

  async list() {
    const existing = await this.prisma.db.documentTemplate.findMany({ orderBy: { name: 'asc' } });
    const existingKeys = new Set(existing.map((t) => t.key));
    const missing = DEFAULT_TEMPLATES.filter((t) => !existingKeys.has(t.key));
    if (!missing.length) return existing;

    await this.prisma.db.documentTemplate.createMany({
      data: missing.map((t) => tenantScopedCreate({ key: t.key, name: t.name, content: t.content, mergeFields: t.mergeFields })),
    });
    return this.prisma.db.documentTemplate.findMany({ orderBy: { name: 'asc' } });
  }

  /** Editing never overwrites what's live: it bumps the version and
   * drops back to DRAFT, so anyone generating a document off the
   * currently PUBLISHED version keeps getting exactly that until a
   * PROPRIETOR deliberately publishes the new draft (see publish()). */
  async update(id: string, dto: UpdateDocumentTemplateDto) {
    const before = await this.prisma.db.documentTemplate.findUniqueOrThrow({ where: { id } });
    const updated = await this.prisma.db.documentTemplate.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        content: dto.content ?? before.content,
        version: before.version + 1,
        status: 'DRAFT',
        updatedById: this.requestContext.getUserId() ?? undefined,
      },
    });
    await this.audit.log({
      action: 'DOCUMENT_TEMPLATE_EDITED',
      entityType: 'DocumentTemplate',
      entityId: id,
      before: { version: before.version, status: before.status },
      after: { version: updated.version, status: updated.status },
    });
    return updated;
  }

  async publish(id: string) {
    const before = await this.prisma.db.documentTemplate.findUniqueOrThrow({ where: { id } });
    const updated = await this.prisma.db.documentTemplate.update({ where: { id }, data: { status: 'PUBLISHED' } });
    await this.audit.log({
      action: 'DOCUMENT_TEMPLATE_PUBLISHED',
      entityType: 'DocumentTemplate',
      entityId: id,
      before: { status: before.status, version: before.version },
      after: { status: 'PUBLISHED', version: updated.version },
    });
    return updated;
  }

  /** Renders the template's merge fields against real records where the
   * domain actually exists (student/school/term, for REPORT_CARD and
   * ADMISSION_LETTER). FEE_INVOICE/PAYMENT_RECEIPT have nothing real to
   * resolve against — there's no Fees module in this build — so those
   * say so plainly instead of inventing sample numbers, the same
   * "this isn't showing you fake data" convention the frontend already
   * uses for CBT exams/lessons that aren't built yet. */
  async preview(id: string) {
    const template = await this.prisma.db.documentTemplate.findUniqueOrThrow({ where: { id } });
    const context = await this.buildSampleContext(template.key);
    const rendered = template.content.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(context, key) ? context[key] : match,
    );
    return { ...template, rendered };
  }

  private requireTenantId(): string {
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId) throw new ForbiddenException('No tenant context');
    return tenantId;
  }

  private async buildSampleContext(key: string): Promise<Record<string, string>> {
    const tenantId = this.requireTenantId();
    const [tenant, session, term, principal] = await Promise.all([
      this.prisma.raw.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } }),
      this.academicSessions.getCurrentSession(),
      this.academicSessions.getCurrentTerm(),
      this.prisma.db.user.findFirst({ where: { role: 'PRINCIPAL' }, select: { firstName: true, lastName: true } }),
    ]);

    const base: Record<string, string> = {
      'school.name': tenant.name,
      'school.principalName': principal ? `${principal.firstName} ${principal.lastName}` : '(no Principal account set up yet)',
      'term.name': term ? term.name.charAt(0) + term.name.slice(1).toLowerCase() : '(no current term set)',
      'session.name': session?.name ?? '(no current session set)',
    };

    if (key === 'REPORT_CARD') {
      const student = await this.prisma.db.student.findFirst({
        where: { status: 'ACTIVE', currentClassArmId: { not: null } },
        include: { currentClassArm: { include: { schoolClass: true } } },
        orderBy: { createdAt: 'asc' },
      });
      if (!student) {
        return { ...base, 'student.name': '(no active student to preview with yet)', 'student.class': '', 'student.admissionNo': '', 'subject.scores': '' };
      }
      const results = await this.prisma.db.result.findMany({
        where: { studentId: student.id, status: 'PUBLISHED' },
        include: { subject: true },
        take: 8,
      });
      return {
        ...base,
        'student.name': `${student.firstName} ${student.lastName}`,
        'student.class': student.currentClassArm ? `${student.currentClassArm.schoolClass.name} ${student.currentClassArm.name}` : '(no class assigned)',
        'student.admissionNo': student.admissionNo,
        'subject.scores': results.length
          ? results.map((r) => `${r.subject.name}: ${r.totalScore ?? '—'}${r.grade ? ` (${r.grade})` : ''}`).join('\n')
          : '(this student has no published results yet)',
      };
    }

    if (key === 'ADMISSION_LETTER') {
      const applicant = await this.prisma.db.student.findFirst({
        where: { status: 'APPLICANT' },
        include: { currentClassArm: { include: { schoolClass: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return {
        ...base,
        'applicant.name': applicant ? `${applicant.firstName} ${applicant.lastName}` : '(no applicant on file yet)',
        'applicant.class': applicant?.currentClassArm?.schoolClass.name ?? '(no class assigned)',
      };
    }

    // FEE_INVOICE / PAYMENT_RECEIPT: no Fees/payments module exists in
    // this build yet (see CLAUDE.md's Phase 2 non-goals) — say so rather
    // than fabricate an invoice.
    return {
      ...base,
      'student.name': '(fees module not built yet)',
      'student.class': '(fees module not built yet)',
      'invoice.number': '(fees module not built yet)',
      'invoice.items': '(fees module not built yet)',
      'invoice.total': '(fees module not built yet)',
      'invoice.dueDate': '(fees module not built yet)',
      'receipt.number': '(fees module not built yet)',
      'payment.amount': '(fees module not built yet)',
      'payment.method': '(fees module not built yet)',
      'payment.date': '(fees module not built yet)',
    };
  }
}
