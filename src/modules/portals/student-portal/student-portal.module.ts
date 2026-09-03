import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../../assignments/assignments.module';
import { AttendanceModule } from '../../attendance/attendance.module';
import { ResultsModule } from '../../results/results.module';
import { StudentPortalController } from './student-portal.controller';

@Module({
  imports: [ResultsModule, AttendanceModule, AssignmentsModule],
  controllers: [StudentPortalController],
})
export class StudentPortalModule {}
