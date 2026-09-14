-- CreateEnum
CREATE TYPE "SchoolLevel" AS ENUM ('NURSERY', 'PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY');

-- AlterTable
ALTER TABLE "school_classes" ADD COLUMN     "level" "SchoolLevel" NOT NULL DEFAULT 'JUNIOR_SECONDARY',
ADD COLUMN     "promotesToClassId" TEXT;

-- AddForeignKey
ALTER TABLE "school_classes" ADD CONSTRAINT "school_classes_promotesToClassId_fkey" FOREIGN KEY ("promotesToClassId") REFERENCES "school_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
