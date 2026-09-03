import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module';
import { CbtExamsController } from './cbt-exams.controller';
import { CbtExamsService } from './cbt-exams.service';

@Module({
  imports: [ClassesModule],
  controllers: [CbtExamsController],
  providers: [CbtExamsService],
  exports: [CbtExamsService],
})
export class CbtExamsModule {}
