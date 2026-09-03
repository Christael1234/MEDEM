import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { ClassesService } from './classes.service';
import { CreateClassArmDto } from './dto/create-class-arm.dto';
import { CreateSchoolClassDto } from './dto/create-school-class.dto';
import { UpdateClassArmDto } from './dto/update-class-arm.dto';
import { UpdateSchoolClassDto } from './dto/update-school-class.dto';

@Controller()
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('classes')
  createClass(@Body() dto: CreateSchoolClassDto) {
    return this.classesService.createClass(dto);
  }

  @AllowAnyAuthenticatedRole()
  @Get('classes')
  listClasses(@Query('campusId') campusId?: string) {
    return this.classesService.listClasses(campusId);
  }

  @AllowAnyAuthenticatedRole()
  @Get('classes/:id')
  getClass(@Param('id') id: string) {
    return this.classesService.getClass(id);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Patch('classes/:id')
  updateClass(@Param('id') id: string, @Body() dto: UpdateSchoolClassDto) {
    return this.classesService.updateClass(id, dto);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('class-arms')
  createArm(@Body() dto: CreateClassArmDto) {
    return this.classesService.createArm(dto);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Patch('class-arms/:id')
  updateArm(@Param('id') id: string, @Body() dto: UpdateClassArmDto) {
    return this.classesService.updateArm(id, dto);
  }

  @AllowAnyAuthenticatedRole()
  @Get('classes/:id/arms')
  listArms(@Param('id') id: string) {
    return this.classesService.listArms(id);
  }
}
