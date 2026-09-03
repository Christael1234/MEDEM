import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { CbtExamsService } from './cbt-exams.service';
import { CreateCbtExamDto } from './dto/create-cbt-exam.dto';
import { RejectCbtExamDto } from './dto/reject-cbt-exam.dto';
import { SubmitCbtAttemptDto } from './dto/submit-cbt-attempt.dto';

@Controller()
export class CbtExamsController {
  constructor(private readonly cbtExamsService: CbtExamsService) {}

  @Roles('TEACHER')
  @Post('cbt-exams')
  create(@Body() dto: CreateCbtExamDto) {
    return this.cbtExamsService.create(dto);
  }

  @AllowAnyAuthenticatedRole()
  @Get('class-arms/:id/cbt-exams')
  listForClassArm(@Param('id') id: string) {
    return this.cbtExamsService.listForClassArm(id);
  }

  // Must be registered before the ':id' route below so 'pending-review'
  // isn't swallowed as an :id.
  @Roles('PRINCIPAL', 'PROPRIETOR')
  @Get('cbt-exams/pending-review')
  listPendingReview() {
    return this.cbtExamsService.listPendingReview();
  }

  @AllowAnyAuthenticatedRole()
  @Get('cbt-exams/:id')
  getOne(@Param('id') id: string) {
    return this.cbtExamsService.getOne(id);
  }

  @Roles('TEACHER')
  @Post('cbt-exams/:id/submit')
  submitForApproval(@Param('id') id: string) {
    return this.cbtExamsService.submitForApproval(id);
  }

  @Roles('PRINCIPAL', 'PROPRIETOR')
  @Post('cbt-exams/:id/approve')
  approve(@Param('id') id: string) {
    return this.cbtExamsService.approve(id);
  }

  @Roles('PRINCIPAL', 'PROPRIETOR')
  @Post('cbt-exams/:id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectCbtExamDto) {
    return this.cbtExamsService.reject(id, dto);
  }

  @Roles('STUDENT')
  @Post('cbt-exams/:id/attempts')
  startAttempt(@Param('id') id: string) {
    return this.cbtExamsService.startAttempt(id);
  }

  @Roles('STUDENT')
  @Post('cbt-exams/:id/attempts/:attemptId/submit')
  submitAttempt(
    @Param('id') id: string,
    @Param('attemptId') attemptId: string,
    @Body() dto: SubmitCbtAttemptDto,
  ) {
    return this.cbtExamsService.submitAttempt(id, attemptId, dto);
  }

  @Roles('TEACHER', 'PRINCIPAL', 'PROPRIETOR')
  @Get('cbt-exams/:id/attempts')
  listAttempts(@Param('id') id: string) {
    return this.cbtExamsService.listAttempts(id);
  }
}
