import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './guards/roles.guard';
import { CampusScopeGuard } from './guards/campus-scope.guard';

@Module({
  providers: [
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CampusScopeGuard },
  ],
})
export class RbacModule {}
