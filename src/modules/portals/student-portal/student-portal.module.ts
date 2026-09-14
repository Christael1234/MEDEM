import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../../assignments/assignments.module';
import { AttendanceModule } from '../../attendance/attendance.module';
import { ClassesModule } from '../../classes/classes.module';
import { ResultsModule } from '../../results/results.module';
import { StudentsModule } from '../../students/students.module';
import { TimetableModule } from '../../timetable/timetable.module';
import { StudentPortalController } from './student-portal.controller';

@Module({
  imports: [ResultsModule, AttendanceModule, AssignmentsModule, TimetableModule, StudentsModule, ClassesModule],
  controllers: [StudentPortalController],
})
export class StudentPortalModule {}
