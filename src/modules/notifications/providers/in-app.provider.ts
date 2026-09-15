import { Injectable } from '@nestjs/common';
import {
  NotificationDispatchPayload,
  NotificationDispatchResult,
  NotificationProvider,
} from './notification-provider.interface';

/** Always configured: in-app delivery is the Notification row
 * NotificationService writes unconditionally; this provider only marks
 * the corresponding CommunicationLog entry as delivered. */
@Injectable()
export class InAppProvider implements NotificationProvider {
  readonly channel = 'IN_APP' as const;
  readonly isConfigured = true;

  async send(_payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    return { status: 'DELIVERED' };
  }
}
