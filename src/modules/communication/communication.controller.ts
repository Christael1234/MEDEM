import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { AnnouncementsService } from './announcements.service';
import { CommunicationLogService } from './communication-log.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { TemplatesService } from './templates.service';

const STAFF_ROLES = ['PROPRIETOR', 'PRINCIPAL', 'TEACHER', 'HR_ADMIN', 'BURSAR'] as const;

@Controller('communication')
export class CommunicationController {
  constructor(
    private readonly templates: TemplatesService,
    private readonly announcements: AnnouncementsService,
    private readonly logs: CommunicationLogService,
  ) {}

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('templates')
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.templates.create(dto);
  }

  @Roles(...STAFF_ROLES)
  @Get('templates')
  listTemplates() {
    return this.templates.list();
  }

  @Roles('PROPRIETOR', 'PRINCIPAL', 'TEACHER')
  @Post('announcements')
  createAnnouncement(@Body() dto: CreateAnnouncementDto) {
    return this.announcements.create(dto);
  }

  @Roles(...STAFF_ROLES)
  @Get('announcements')
  listAnnouncements() {
    return this.announcements.list();
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Get('logs')
  listLogs(@Query('recipientUserId') recipientUserId?: string) {
    return this.logs.list({ recipientUserId });
  }
}
