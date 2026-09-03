import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationDispatchPayload,
  NotificationDispatchResult,
  NotificationProvider,
} from './notification-provider.interface';

/** Stub adapter — same shape as EmailProvider. `WHATSAPP_PROVIDER`
 * defaults to `none`. Explicitly deferred per user instruction — leave
 * unconfigured until asked to wire a real WhatsApp provider. */
@Injectable()
export class WhatsAppProvider implements NotificationProvider {
  readonly channel = 'WHATSAPP' as const;
  readonly isConfigured: boolean;

  constructor(config: ConfigService) {
    this.isConfigured = config.get<string>('WHATSAPP_PROVIDER', 'none') !== 'none';
  }

  async send(_payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    throw new Error(
      'WhatsAppProvider has no real implementation yet — set WHATSAPP_PROVIDER and implement send() when a provider is chosen.',
    );
  }
}
