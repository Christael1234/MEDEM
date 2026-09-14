import { Module } from '@nestjs/common';
import { ClassesModule } from '../../classes/classes.module';
import { StaffProfilesModule } from '../../staff-profiles/staff-profiles.module';
import { StudentsModule } from '../../students/students.module';
import { SubjectsModule } from '../../subjects/subjects.module';
import { TimetableModule } from '../../timetable/timetable.module';
import { TeacherPortalController } from './teacher-portal.controller';

@Module({
  imports: [StaffProfilesModule, SubjectsModule, StudentsModule, ClassesModule, TimetableModule],
  controllers: [TeacherPortalController],
})
export class TeacherPortalModule {}
