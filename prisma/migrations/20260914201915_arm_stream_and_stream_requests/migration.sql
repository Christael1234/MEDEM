-- CreateEnum
CREATE TYPE "StreamChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "class_arms" ADD COLUMN     "stream" "Stream";

-- CreateTable
CREATE TABLE "stream_change_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestedStream" "Stream" NOT NULL,
    "status" "StreamChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "stream_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stream_change_requests_tenantId_status_idx" ON "stream_change_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "stream_change_requests_studentId_idx" ON "stream_change_requests"("studentId");

-- AddForeignKey
ALTER TABLE "stream_change_requests" ADD CONSTRAINT "stream_change_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stream_change_requests" ADD CONSTRAINT "stream_change_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stream_change_requests" ADD CONSTRAINT "stream_change_requests_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
