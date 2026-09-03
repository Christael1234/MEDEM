import { Module } from '@nestjs/common';
import { AcademicSessionsController } from './academic-sessions.controller';
import { AcademicSessionsService } from './academic-sessions.service';

@Module({
  controllers: [AcademicSessionsController],
  providers: [AcademicSessionsService],
  exports: [AcademicSessionsService],
})
export class AcademicSessionsModule {}
