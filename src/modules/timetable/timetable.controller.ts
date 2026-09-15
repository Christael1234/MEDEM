import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { UpdateTimetableSettingsDto } from './dto/update-timetable-settings.dto';
import { TimetableService } from './timetable.service';

@Controller('timetable')
export class TimetableController {
  constructor(private readonly timetable: TimetableService) {}

  @AllowAnyAuthenticatedRole()
  @Get('settings')
  getSettings() {
    return this.timetable.getSettings();
  }

  // Set break times (and, optionally, the day's start/end) BEFORE
  // generating. Generate always rebuilds from whatever settings are
  // current at that moment.
  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Put('settings')
  updateSettings(@Body() dto: UpdateTimetableSettingsDto) {
    return this.timetable.updateSettings(dto);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('generate')
  generate() {
    return this.timetable.generate();
  }

  @AllowAnyAuthenticatedRole()
  @Get('class-arm/:id')
  forClassArm(@Param('id') id: string) {
    return this.timetable.getForClassArm(id);
  }
}
