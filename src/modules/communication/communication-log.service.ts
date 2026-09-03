import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CommunicationLogService {
  constructor(private readonly prisma: PrismaService) {}

  list(filter: { recipientUserId?: string }) {
    return this.prisma.db.communicationLog.findMany({
      where: { recipientUserId: filter.recipientUserId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
