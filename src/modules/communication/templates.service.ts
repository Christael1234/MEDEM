import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTemplateDto) {
    return this.prisma.db.messageTemplate.create({
      data: tenantScopedCreate({
        name: dto.name,
        channel: dto.channel,
        subject: dto.subject,
        body: dto.body,
        placeholders: dto.placeholders ?? [],
      }),
    });
  }

  list() {
    return this.prisma.db.messageTemplate.findMany({ orderBy: { name: 'asc' } });
  }
}
