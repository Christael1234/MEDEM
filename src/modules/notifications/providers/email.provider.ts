import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationDispatchPayload,
  NotificationDispatchResult,
  NotificationProvider,
} from './notification-provider.interface';

/**
 * Stub adapter. `EMAIL_PROVIDER` defaults to `none`, which keeps this
 * unconfigured: NotificationService then leaves the CommunicationLog row
 * QUEUED rather than calling send() or throwing. Real integration
 * (SendGrid, SES, etc.) is an explicit non-goal for this pass, wire a
 * real provider only when asked for one.
 */
@Injectable()
export class EmailProvider implements NotificationProvider {
  readonly channel = 'EMAIL' as const;
  readonly isConfigured: boolean;

  constructor(config: ConfigService) {
    this.isConfigured = config.get<string>('EMAIL_PROVIDER', 'none') !== 'none';
  }

  async send(_payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    throw new Error(
      'EmailProvider has no real implementation yet, set EMAIL_PROVIDER and implement send() when a provider is chosen.',
    );
  }
}
