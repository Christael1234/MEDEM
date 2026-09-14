import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantBrandingDto } from './dto/update-tenant-branding.dto';
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

  // 'me/branding' is a 2-segment path ('tenants/me/branding'), so it never
  // collides with the 1-segment ':id' route below regardless of
  // declaration order — every authenticated user in the tenant can read
  // their own school's colors (needed to paint the UI), but only
  // PROPRIETOR can change them.
  @AllowAnyAuthenticatedRole()
  @Get('me/branding')
  getMyBranding() {
    return this.tenantsService.getMyBranding();
  }

  @Roles('PROPRIETOR')
  @Put('me/branding')
  updateMyBranding(@Body() dto: UpdateTenantBrandingDto) {
    return this.tenantsService.updateMyBranding(dto);
  }

  @Roles('SUPER_ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }
}
