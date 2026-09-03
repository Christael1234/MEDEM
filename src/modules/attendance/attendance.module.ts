import { Module } from '@nestjs/common';
import { AcademicSessionsModule } from '../academic-sessions/academic-sessions.module';
import { ClassesModule } from '../classes/classes.module';
import { StudentsModule } from '../students/students.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [ClassesModule, AcademicSessionsModule, StudentsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
