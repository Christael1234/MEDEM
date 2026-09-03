import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/rbac/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.raw.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'connected' };
  }
}
