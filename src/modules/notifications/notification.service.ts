import { Inject, Injectable } from '@nestjs/common';
import { CommunicationChannel } from '@prisma/client';
import { RequestContextService } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { NOTIFICATION_PROVIDERS, NotificationProvider } from './providers/notification-provider.interface';

export interface NotifyParams {
  recipientUserId: string;
  /** Used as part of the dedupe key and the in-app Notification.type. */
  eventType: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  /** Defaults to [IN_APP] — always-on regardless of external providers. */
  channels?: CommunicationChannel[];
  templateId?: string;
  senderUserId?: string;
  targetDescription?: string;
}

/**
 * Writes the in-app Notification row unconditionally (channel-agnostic —
 * this is what makes "core workflows remain usable with no provider
 * configured" true), then fans out to whichever channels were requested.
 * Each channel dispatch is idempotent: a (tenantId, dedupeKey) pair can
 * only ever produce one CommunicationLog row, so firing the same event
 * twice for the same recipient+channel is a no-op the second time.
 */
@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    @Inject(NOTIFICATION_PROVIDERS) private readonly providers: NotificationProvider[],
  ) {}

  async notify(params: NotifyParams): Promise<void> {
    await this.prisma.db.notification.create({
      data: tenantScopedCreate({
        recipientUserId: params.recipientUserId,
        type: params.eventType,
        title: params.title,
        body: params.body,
        entityType: params.entityType,
        entityId: params.entityId,
      }),
    });

    const channels = params.channels ?? (['IN_APP'] as CommunicationChannel[]);
    for (const channel of channels) {
      await this.dispatchChannel(channel, params);
    }
  }

  private buildDedupeKey(channel: CommunicationChannel, params: NotifyParams): string {
    return [params.entityType ?? 'none', params.entityId ?? 'none', params.eventType, params.recipientUserId, channel].join(
      ':',
    );
  }

  private async dispatchChannel(channel: CommunicationChannel, params: NotifyParams): Promise<void> {
    const dedupeKey = this.buildDedupeKey(channel, params);

    const existing = await this.prisma.db.communicationLog.findFirst({ where: { dedupeKey } });
    if (existing) return;

    const log = await this.prisma.db.communicationLog.create({
      data: tenantScopedCreate({
        senderUserId: params.senderUserId ?? this.requestContext.getUserId(),
        channel,
        templateId: params.templateId,
        recipientUserId: params.recipientUserId,
        targetDescription: params.targetDescription ?? 'individual',
        subject: params.title,
        body: params.body,
        status: 'QUEUED' as const,
        dedupeKey,
      }),
    });

    const provider = this.providers.find((p) => p.channel === channel);
    if (!provider || !provider.isConfigured) {
      // No provider configured for this channel — leave QUEUED, don't throw.
      return;
    }

    try {
      const result = await provider.send({ recipientUserId: params.recipientUserId, subject: params.title, body: params.body });
      await this.prisma.db.communicationLog.update({
        where: { id: log.id },
        data: {
          status: result.status,
          providerRef: result.providerRef,
          sentAt: result.status === 'SENT' || result.status === 'DELIVERED' ? new Date() : undefined,
        },
      });
    } catch {
      await this.prisma.db.communicationLog.update({ where: { id: log.id }, data: { status: 'FAILED' } });
    }
  }
}
