import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { CreateStaffProfileDto } from './dto/create-staff-profile.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { StaffProfilesService } from './staff-profiles.service';

@Controller('staff-profiles')
export class StaffProfilesController {
  constructor(private readonly staffProfilesService: StaffProfilesService) {}

  @Roles('PROPRIETOR', 'HR_ADMIN')
  @Post()
  create(@Body() dto: CreateStaffProfileDto) {
    return this.staffProfilesService.create(dto);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('teachers')
  createTeacher(@Body() dto: CreateTeacherDto) {
    return this.staffProfilesService.createTeacher(dto);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL', 'HR_ADMIN', 'BURSAR')
  @Get()
  list(@Query('campusId') campusId?: string) {
    return this.staffProfilesService.list(campusId);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL', 'HR_ADMIN', 'BURSAR')
  @Get('by-user/:userId')
  findByUserId(@Param('userId') userId: string) {
    return this.staffProfilesService.findByUserId(userId);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL', 'HR_ADMIN', 'BURSAR')
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.staffProfilesService.getOne(id);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL', 'HR_ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    return this.staffProfilesService.update(id, dto);
  }
}
