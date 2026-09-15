import { CommunicationChannel, CommunicationStatus } from '@prisma/client';

export interface NotificationDispatchPayload {
  recipientUserId: string;
  recipientContact?: string;
  subject?: string;
  body: string;
}

export interface NotificationDispatchResult {
  status: CommunicationStatus;
  providerRef?: string;
}

/** One adapter per channel, all behind the same shape. `isConfigured`
 * false means NotificationService leaves the CommunicationLog row QUEUED
 * instead of calling send(): graceful degradation per Phase 4 rule #4:
 * in-app + history must keep working with zero external providers set up. */
export interface NotificationProvider {
  readonly channel: CommunicationChannel;
  readonly isConfigured: boolean;
  send(payload: NotificationDispatchPayload): Promise<NotificationDispatchResult>;
}

export const NOTIFICATION_PROVIDERS = 'NOTIFICATION_PROVIDERS';
