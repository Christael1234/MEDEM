import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Roles('SUPER_ADMIN')
  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.provision(dto);
  }

  @Roles('SUPER_ADMIN')
  @Get()
  list() {
    return this.tenantsService.list();
  }

  @Roles('SUPER_ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }
}
