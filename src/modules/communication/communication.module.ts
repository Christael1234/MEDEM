import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module';
import { AnnouncementsService } from './announcements.service';
import { CommunicationController } from './communication.controller';
import { CommunicationLogService } from './communication-log.service';
import { TemplatesService } from './templates.service';

@Module({
  imports: [ClassesModule],
  controllers: [CommunicationController],
  providers: [TemplatesService, AnnouncementsService, CommunicationLogService],
})
export class CommunicationModule {}
