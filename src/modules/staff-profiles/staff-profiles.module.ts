import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module';
import { StaffProfilesController } from './staff-profiles.controller';
import { StaffProfilesService } from './staff-profiles.service';

@Module({
  imports: [ClassesModule],
  controllers: [StaffProfilesController],
  providers: [StaffProfilesService],
  exports: [StaffProfilesService],
})
export class StaffProfilesModule {}
