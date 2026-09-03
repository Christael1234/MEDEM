import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateLessonResourceDto } from './dto/create-lesson-resource.dto';
import { LessonsService } from './lessons.service';

@Controller()
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Roles('TEACHER')
  @Post('lessons')
  create(@Body() dto: CreateLessonDto) {
    return this.lessonsService.create(dto);
  }

  @AllowAnyAuthenticatedRole()
  @Get('class-arms/:id/lessons')
  listForClassArm(@Param('id') id: string) {
    return this.lessonsService.listForClassArm(id);
  }

  @Roles('TEACHER')
  @Post('lessons/:id/resources')
  addResource(@Param('id') id: string, @Body() dto: CreateLessonResourceDto) {
    return this.lessonsService.addResource(id, dto);
  }
}
