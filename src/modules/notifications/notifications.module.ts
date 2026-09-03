import { Global, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { EmailProvider } from './providers/email.provider';
import { InAppProvider } from './providers/in-app.provider';
import { NOTIFICATION_PROVIDERS, NotificationProvider } from './providers/notification-provider.interface';
import { SmsProvider } from './providers/sms.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    InAppProvider,
    EmailProvider,
    SmsProvider,
    WhatsAppProvider,
    {
      provide: NOTIFICATION_PROVIDERS,
      useFactory: (
        inApp: InAppProvider,
        email: EmailProvider,
        sms: SmsProvider,
        whatsapp: WhatsAppProvider,
      ): NotificationProvider[] => [inApp, email, sms, whatsapp],
      inject: [InAppProvider, EmailProvider, SmsProvider, WhatsAppProvider],
    },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
