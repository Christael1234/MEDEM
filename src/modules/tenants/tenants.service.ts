import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { sanitizeUser } from '../../common/utils/sanitize-user';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

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
}
