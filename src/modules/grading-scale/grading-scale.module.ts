import { Module } from '@nestjs/common';
import { GradingScaleController } from './grading-scale.controller';
import { GradingScaleService } from './grading-scale.service';

@Module({
  controllers: [GradingScaleController],
  providers: [GradingScaleService],
  exports: [GradingScaleService],
})
export class GradingScaleModule {}
