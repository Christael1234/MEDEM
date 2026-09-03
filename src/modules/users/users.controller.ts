import { Body, Controller, Get, Post } from '@nestjs/common';
import { AllowAnyAuthenticatedRole } from '../../common/rbac/decorators/allow-any-role.decorator';
import { Roles } from '../../common/rbac/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('PROPRIETOR', 'HR_ADMIN')
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @AllowAnyAuthenticatedRole()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findSelf(user.userId);
  }

  @Roles('PROPRIETOR', 'PRINCIPAL', 'HR_ADMIN', 'BURSAR')
  @Get()
  list() {
    return this.usersService.list();
  }
}
