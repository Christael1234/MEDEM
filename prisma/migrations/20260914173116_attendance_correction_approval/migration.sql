-- CreateEnum
CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "correctionStatus" "AttendanceCorrectionStatus",
ADD COLUMN     "rejectionReason" TEXT;

-- CreateIndex
CREATE INDEX "attendance_records_tenantId_correctionStatus_idx" ON "attendance_records"("tenantId", "correctionStatus");
