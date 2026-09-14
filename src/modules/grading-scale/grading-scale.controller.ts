import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { CreateGradeBandDto } from './dto/create-grade-band.dto';
import { UpdateGradeBandDto } from './dto/update-grade-band.dto';
import { GradingScaleService } from './grading-scale.service';

@Controller('grading-scale')
export class GradingScaleController {
  constructor(private readonly gradingScale: GradingScaleService) {}

  @AllowAnyAuthenticatedRole()
  @Get()
  list() {
    return this.gradingScale.list();
  }

  @Roles('PROPRIETOR')
  @Post()
  create(@Body() dto: CreateGradeBandDto) {
    return this.gradingScale.create(dto);
  }

  @Roles('PROPRIETOR')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGradeBandDto) {
    return this.gradingScale.update(id, dto);
  }

  @Roles('PROPRIETOR')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gradingScale.remove(id);
  }
}
