import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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

  @AllowAnyAuthenticatedRole()
  @Get('academic-sessions/current')
  async getCurrent() {
    const session = await this.service.getCurrentSession();
    const term = await this.service.getCurrentTerm();
    return { session, term };
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

  // The one action that flips which session/term is "current"; see
  // AcademicSessionsService.activateTerm. Backs both "advance to next
  // term" and "start new session" (create the term, then activate it) in
  // the topbar's session/term picker.
  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Patch('terms/:id/activate')
  activateTerm(@Param('id') id: string) {
    return this.service.activateTerm(id);
  }
}
