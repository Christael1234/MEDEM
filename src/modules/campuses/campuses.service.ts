import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { CreateCampusDto } from './dto/create-campus.dto';

@Injectable()
export class CampusesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCampusDto) {
    return this.prisma.db.campus.create({
      data: tenantScopedCreate({ name: dto.name, address: dto.address }),
    });
  }

  list() {
    return this.prisma.db.campus.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(id: string) {
    return this.prisma.db.campus.findUniqueOrThrow({ where: { id } });
  }
}
