import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { CreateResultDto } from './dto/create-result.dto';
import { ResultsService } from './results.service';

@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Roles('PROPRIETOR', 'PRINCIPAL', 'TEACHER')
  @Post()
  create(@Body() dto: CreateResultDto) {
    return this.resultsService.create(dto);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL', 'TEACHER')
  @Patch(':id/submit')
  submit(@Param('id') id: string) {
    return this.resultsService.submit(id);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.resultsService.approve(id);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Patch(':id/publish')
  publish(@Param('id') id: string) {
    return this.resultsService.publish(id);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Get('report')
  report(
    @Query('termId') termId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('classArmId') classArmId?: string,
  ) {
    return this.resultsService.report({ termId, subjectId, classArmId });
  }

  @AllowAnyAuthenticatedRole()
  @Get()
  list(
    @Query('studentId') studentId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('termId') termId?: string,
  ) {
    return this.resultsService.list({ studentId, subjectId, termId });
  }
}
