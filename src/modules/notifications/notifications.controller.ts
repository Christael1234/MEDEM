import { Controller, ForbiddenException, Get, Param, Patch } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';

/** "My notices" for any authenticated role — scoped by recipientUserId
 * from the session, never a request parameter. */
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  @AllowAnyAuthenticatedRole()
  @Get('me')
  myNotifications() {
    const userId = this.requestContext.getUserId();
    if (!userId) throw new ForbiddenException();
    return this.prisma.db.notification.findMany({
      where: { recipientUserId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @AllowAnyAuthenticatedRole()
  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    const userId = this.requestContext.getUserId();
    if (!userId) throw new ForbiddenException();

    const notification = await this.prisma.db.notification.findUniqueOrThrow({ where: { id } });
    if (notification.recipientUserId !== userId) {
      throw new ForbiddenException('Not your notification');
    }
    return this.prisma.db.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
}
