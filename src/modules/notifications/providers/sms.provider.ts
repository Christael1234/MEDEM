import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationDispatchPayload,
  NotificationDispatchResult,
  NotificationProvider,
} from './notification-provider.interface';

/** Stub adapter, same shape as EmailProvider. `SMS_PROVIDER` defaults to
 * `none`. Real integration (Termii, Twilio, etc.) is a non-goal for now. */
@Injectable()
export class SmsProvider implements NotificationProvider {
  readonly channel = 'SMS' as const;
  readonly isConfigured: boolean;

  constructor(config: ConfigService) {
    this.isConfigured = config.get<string>('SMS_PROVIDER', 'none') !== 'none';
  }

  async send(_payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    throw new Error(
      'SmsProvider has no real implementation yet, set SMS_PROVIDER and implement send() when a provider is chosen.',
    );
  }
}
