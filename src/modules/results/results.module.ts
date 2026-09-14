import { Module } from '@nestjs/common';
import { AcademicSessionsModule } from '../academic-sessions/academic-sessions.module';
import { ClassesModule } from '../classes/classes.module';
import { GradingScaleModule } from '../grading-scale/grading-scale.module';
import { StudentsModule } from '../students/students.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  imports: [AcademicSessionsModule, StudentsModule, ClassesModule, GradingScaleModule],
  controllers: [ResultsController],
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule {}
