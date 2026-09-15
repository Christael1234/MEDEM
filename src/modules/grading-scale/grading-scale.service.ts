import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantScopedCreate } from '../../common/prisma/tenant-scoped-create';
import { CreateGradeBandDto } from './dto/create-grade-band.dto';
import { UpdateGradeBandDto } from './dto/update-grade-band.dto';

@Injectable()
export class GradingScaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.db.gradeBand.findMany({ orderBy: { minScore: 'asc' } });
  }

  async create(dto: CreateGradeBandDto) {
    this.assertValidRange(dto.minScore, dto.maxScore);
    await this.assertNoOverlap(dto.minScore, dto.maxScore);

    const band = await this.prisma.db.gradeBand.create({
      data: tenantScopedCreate({ grade: dto.grade, minScore: dto.minScore, maxScore: dto.maxScore, meaning: dto.meaning }),
    });

    await this.audit.log({
      action: 'GRADE_BAND_CREATED',
      entityType: 'GradeBand',
      entityId: band.id,
      after: { grade: band.grade, minScore: band.minScore, maxScore: band.maxScore },
    });

    return band;
  }

  async update(id: string, dto: UpdateGradeBandDto) {
    const before = await this.prisma.db.gradeBand.findUniqueOrThrow({ where: { id } });
    const minScore = dto.minScore ?? before.minScore;
    const maxScore = dto.maxScore ?? before.maxScore;
    this.assertValidRange(minScore, maxScore);
    await this.assertNoOverlap(minScore, maxScore, id);

    const updated = await this.prisma.db.gradeBand.update({
      where: { id },
      data: { grade: dto.grade, minScore: dto.minScore, maxScore: dto.maxScore, meaning: dto.meaning },
    });

    await this.audit.log({
      action: 'GRADE_BAND_UPDATED',
      entityType: 'GradeBand',
      entityId: id,
      before: { grade: before.grade, minScore: before.minScore, maxScore: before.maxScore },
      after: { grade: updated.grade, minScore: updated.minScore, maxScore: updated.maxScore },
    });

    return updated;
  }

  async remove(id: string) {
    const before = await this.prisma.db.gradeBand.findUniqueOrThrow({ where: { id } });
    await this.prisma.db.gradeBand.delete({ where: { id } });

    await this.audit.log({
      action: 'GRADE_BAND_DELETED',
      entityType: 'GradeBand',
      entityId: id,
      before: { grade: before.grade, minScore: before.minScore, maxScore: before.maxScore },
    });
  }

  /** Used by ResultsService at result-creation time, computed once and
   * stored on the Result, never recalculated later (a scale edit must not
   * retroactively rewrite a grade already on the books). Returns null
   * (not an error) when no band is configured yet or none covers this
   * score: an honest "ungraded" beats a guessed grade. */
  async computeGrade(totalScore: number): Promise<string | null> {
    const band = await this.prisma.db.gradeBand.findFirst({
      where: { minScore: { lte: totalScore }, maxScore: { gte: totalScore } },
    });
    return band?.grade ?? null;
  }

  private assertValidRange(minScore: number, maxScore: number): void {
    if (minScore > maxScore) {
      throw new BadRequestException('minScore cannot be greater than maxScore');
    }
  }

  private async assertNoOverlap(minScore: number, maxScore: number, excludeId?: string): Promise<void> {
    const bands = await this.prisma.db.gradeBand.findMany({
      where: excludeId ? { id: { not: excludeId } } : undefined,
    });
    const overlap = bands.find((b) => minScore <= b.maxScore && b.minScore <= maxScore);
    if (overlap) {
      throw new ConflictException(`Overlaps existing band ${overlap.grade} (${overlap.minScore}-${overlap.maxScore})`);
    }
  }
}
