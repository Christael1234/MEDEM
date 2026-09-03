import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { sanitizeUser } from '../../common/utils/sanitize-user';
import { CreateUserDto } from './dto/create-user.dto';

const HR_ASSIGNABLE_ROLES: Role[] = ['TEACHER', 'OTHER_STAFF', 'TRANSPORT_STAFF', 'LIBRARY_STAFF'];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly requestContext: RequestContextService,
  ) {}

  async create(dto: CreateUserDto) {
    if (dto.role === 'SUPER_ADMIN' || dto.role === 'PROPRIETOR') {
      throw new ForbiddenException(`Role ${dto.role} cannot be created through this endpoint`);
    }

    const actorRole = this.requestContext.getRole();
    if (actorRole === 'HR_ADMIN' && !HR_ASSIGNABLE_ROLES.includes(dto.role)) {
      throw new ForbiddenException(`HR_ADMIN cannot create role ${dto.role}`);
    }

    if (dto.campusIds?.length) {
      await this.assertCampusesInTenant(dto.campusIds);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.db.user.create({
      data: {
        role: dto.role,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
      },
    });

    if (dto.campusIds?.length) {
      await this.prisma.db.userCampusScope.createMany({
        data: dto.campusIds.map((campusId) => ({ userId: user.id, campusId })),
      });
    }

    await this.audit.log({
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      after: { email: user.email, role: user.role, campusIds: dto.campusIds ?? [] },
    });

    return sanitizeUser(user);
  }

  async findSelf(userId: string) {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return sanitizeUser(user);
  }

  async list() {
    const users = await this.prisma.db.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map(sanitizeUser);
  }

  /** Campus IS tenant-scoped, so this query can only ever return campuses
   * belonging to the caller's own tenant — if fewer rows come back than
   * campusIds requested, at least one id was invalid or belongs to
   * another tenant (rule #1: tenant isolation is absolute). */
  private async assertCampusesInTenant(campusIds: string[]): Promise<void> {
    const found = await this.prisma.db.campus.findMany({
      where: { id: { in: campusIds } },
      select: { id: true },
    });
    if (found.length !== new Set(campusIds).size) {
      throw new ForbiddenException('One or more campusIds are invalid for this tenant');
    }
  }
}
