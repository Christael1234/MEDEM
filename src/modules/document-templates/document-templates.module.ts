import { Module } from '@nestjs/common';
import { AcademicSessionsModule } from '../academic-sessions/academic-sessions.module';
import { DocumentTemplatesController } from './document-templates.controller';
import { DocumentTemplatesService } from './document-templates.service';

@Module({
  imports: [AcademicSessionsModule],
  controllers: [DocumentTemplatesController],
  providers: [DocumentTemplatesService],
})
export class DocumentTemplatesModule {}
