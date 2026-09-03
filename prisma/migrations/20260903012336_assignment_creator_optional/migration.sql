-- DropForeignKey
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_createdByStaffProfileId_fkey";

-- AlterTable
ALTER TABLE "assignments" ALTER COLUMN "createdByStaffProfileId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_createdByStaffProfileId_fkey" FOREIGN KEY ("createdByStaffProfileId") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
