import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { AcademicSessionsService } from './academic-sessions.service';
import { CreateAcademicSessionDto } from './dto/create-academic-session.dto';
import { CreateTermDto } from './dto/create-term.dto';

@Controller()
export class AcademicSessionsController {
  constructor(private readonly service: AcademicSessionsService) {}

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('academic-sessions')
  createSession(@Body() dto: CreateAcademicSessionDto) {
    return this.service.createSession(dto);
  }

  @AllowAnyAuthenticatedRole()
  @Get('academic-sessions')
  listSessions() {
    return this.service.listSessions();
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('terms')
  createTerm(@Body() dto: CreateTermDto) {
    return this.service.createTerm(dto);
  }

  @AllowAnyAuthenticatedRole()
  @Get('academic-sessions/:id/terms')
  listTerms(@Param('id') id: string) {
    return this.service.listTerms(id);
  }
}
