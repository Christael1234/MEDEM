import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContextModule } from './common/context/context.module';
import { NumberingModule } from './common/numbering/numbering.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RbacModule } from './common/rbac/rbac.module';
import { AcademicSessionsModule } from './modules/academic-sessions/academic-sessions.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CampusesModule } from './modules/campuses/campuses.module';
import { CbtExamsModule } from './modules/cbt-exams/cbt-exams.module';
import { ClassesModule } from './modules/classes/classes.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { GuardiansModule } from './modules/guardians/guardians.module';
import { HealthModule } from './modules/health/health.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ParentPortalModule } from './modules/portals/parent-portal/parent-portal.module';
import { StudentPortalModule } from './modules/portals/student-portal/student-portal.module';
import { TeacherPortalModule } from './modules/portals/teacher-portal/teacher-portal.module';
import { ResultsModule } from './modules/results/results.module';
import { StaffProfilesModule } from './modules/staff-profiles/staff-profiles.module';
import { StudentsModule } from './modules/students/students.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ContextModule,
    PrismaModule,
    AuditModule,
    NumberingModule,
    NotificationsModule,
    // AuthModule registers JwtAuthGuard as APP_GUARD — must run before
    // RbacModule's RolesGuard/CampusScopeGuard so req.user is populated.
    AuthModule,
    RbacModule,
    HealthModule,
    TenantsModule,
    CampusesModule,
    UsersModule,
    AcademicSessionsModule,
    ClassesModule,
    SubjectsModule,
    StaffProfilesModule,
    StudentsModule,
    GuardiansModule,
    AttendanceModule,
    ResultsModule,
    AssignmentsModule,
    LessonsModule,
    CbtExamsModule,
    CommunicationModule,
    TeacherPortalModule,
    StudentPortalModule,
    ParentPortalModule,
  ],
})
export class AppModule {}
