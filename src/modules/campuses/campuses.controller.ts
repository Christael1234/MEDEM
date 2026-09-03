import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { CampusesService } from './campuses.service';
import { CreateCampusDto } from './dto/create-campus.dto';

@Controller('campuses')
export class CampusesController {
  constructor(private readonly campusesService: CampusesService) {}

  @Roles('PROPRIETOR')
  @Post()
  create(@Body() dto: CreateCampusDto) {
    return this.campusesService.create(dto);
  }

  @AllowAnyAuthenticatedRole()
  @Get()
  list() {
    return this.campusesService.list();
  }

  @AllowAnyAuthenticatedRole()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campusesService.findOne(id);
  }
}
