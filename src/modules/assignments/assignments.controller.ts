import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Controller()
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Roles('TEACHER', 'PROPRIETOR', 'PRINCIPAL')
  @Post('assignments')
  create(@Body() dto: CreateAssignmentDto) {
    return this.assignmentsService.create(dto);
  }

  @AllowAnyAuthenticatedRole()
  @Get('class-arms/:id/assignments')
  listForClassArm(@Param('id') id: string) {
    return this.assignmentsService.listForClassArm(id);
  }

  @Roles('TEACHER', 'PROPRIETOR', 'PRINCIPAL')
  @Patch('assignments/:id')
  update(@Param('id') id: string, @Body() dto: UpdateAssignmentDto) {
    return this.assignmentsService.update(id, dto);
  }
}
