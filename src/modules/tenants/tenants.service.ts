import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { sanitizeUser } from '../../common/utils/sanitize-user';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantBrandingDto } from './dto/update-tenant-branding.dto';

/**
 * Tenant provisioning is a platform-level (SUPER_ADMIN) operation with no
 * tenant context of its own — every write here goes through
 * PrismaService.raw inside a transaction, by design (see PrismaService and
 * the tenant-scoping extension doc comments).
 */
@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly requestContext: RequestContextService,
  ) {}

  async provision(dto: CreateTenantDto) {
    const existing = await this.prisma.raw.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Tenant slug '${dto.slug}' is already taken`);
    }

    const passwordHash = await bcrypt.hash(dto.proprietor.password, 12);

    const result = await this.prisma.raw.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          timezone: dto.timezone ?? 'Africa/Lagos',
        },
      });

      const campus = await tx.campus.create({
        data: { tenantId: tenant.id, name: dto.campusName, isPrimary: true },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          role: 'PROPRIETOR',
          email: dto.proprietor.email,
          passwordHash,
          firstName: dto.proprietor.firstName,
          lastName: dto.proprietor.lastName,
        },
      });

      return { tenant, campus, user };
    });

    await this.audit.log({
      action: 'TENANT_PROVISIONED',
      entityType: 'Tenant',
      entityId: result.tenant.id,
      after: { name: result.tenant.name, slug: result.tenant.slug },
    });

    return {
      tenant: result.tenant,
      campus: result.campus,
      proprietor: sanitizeUser(result.user),
    };
  }

  list() {
    return this.prisma.raw.tenant.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findOne(id: string) {
    return this.prisma.raw.tenant.findUniqueOrThrow({ where: { id } });
  }

  /** Tenant itself has no tenantId column — it IS the tenant — so it's
   * never auto-scoped by the Prisma extension (see tenant-scoping.extension.ts's
   * doc comment: prisma.db.tenant is a bare passthrough to prisma.raw).
   * Every read/write here explicitly filters to the caller's own tenantId
   * from RequestContextService instead, so a user can only ever see or
   * change their own school's colors, never another tenant's. */
  async getMyBranding() {
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId) throw new ForbiddenException('No tenant context');
    return this.prisma.raw.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { id: true, name: true, primaryColor: true, sidebarColor: true },
    });
  }

  async updateMyBranding(dto: UpdateTenantBrandingDto) {
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId) throw new ForbiddenException('No tenant context');

    const before = await this.prisma.raw.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { primaryColor: true, sidebarColor: true },
    });
    const updated = await this.prisma.raw.tenant.update({
      where: { id: tenantId },
      data: {
        primaryColor: dto.primaryColor ?? undefined,
        sidebarColor: dto.sidebarColor ?? undefined,
      },
      select: { id: true, name: true, primaryColor: true, sidebarColor: true },
    });

    await this.audit.log({
      action: 'TENANT_BRANDING_UPDATED',
      entityType: 'Tenant',
      entityId: tenantId,
      before,
      after: { primaryColor: updated.primaryColor, sidebarColor: updated.sidebarColor },
    });

    return updated;
  }
}
