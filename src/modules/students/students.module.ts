import { Module } from '@nestjs/common';
import { AcademicSessionsModule } from '../academic-sessions/academic-sessions.module';
import { ClassesModule } from '../classes/classes.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [ClassesModule, AcademicSessionsModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
