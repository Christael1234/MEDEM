import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { LinkGuardianDto } from './dto/link-guardian.dto';
import { GuardiansService } from './guardians.service';

@Controller()
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('guardians')
  create(@Body() dto: CreateGuardianDto) {
    return this.guardiansService.create(dto);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL')
  @Post('guardians/link')
  link(@Body() dto: LinkGuardianDto) {
    return this.guardiansService.link(dto);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL', 'BURSAR', 'HR_ADMIN', 'TEACHER')
  @Get('students/:id/guardians')
  listForStudent(@Param('id') id: string) {
    return this.guardiansService.listForStudent(id);
  }

  @AllowAnyAuthenticatedRole()
  @Get('guardians/me/children')
  myChildren() {
    return this.guardiansService.myChildren();
  }
}
