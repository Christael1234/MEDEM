import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../../assignments/assignments.module';
import { AttendanceModule } from '../../attendance/attendance.module';
import { GuardiansModule } from '../../guardians/guardians.module';
import { ResultsModule } from '../../results/results.module';
import { StudentsModule } from '../../students/students.module';
import { ParentPortalController } from './parent-portal.controller';

@Module({
  imports: [GuardiansModule, StudentsModule, ResultsModule, AttendanceModule, AssignmentsModule],
  controllers: [ParentPortalController],
})
export class ParentPortalModule {}
