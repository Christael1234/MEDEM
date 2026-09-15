-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "isCompulsory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isCoreTrade" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "student_subject_selections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_subject_selections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_subject_selections_tenantId_idx" ON "student_subject_selections"("tenantId");

-- CreateIndex
CREATE INDEX "student_subject_selections_studentId_academicSessionId_idx" ON "student_subject_selections"("studentId", "academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "student_subject_selections_studentId_subjectId_academicSess_key" ON "student_subject_selections"("studentId", "subjectId", "academicSessionId");

-- AddForeignKey
ALTER TABLE "student_subject_selections" ADD CONSTRAINT "student_subject_selections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subject_selections" ADD CONSTRAINT "student_subject_selections_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subject_selections" ADD CONSTRAINT "student_subject_selections_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subject_selections" ADD CONSTRAINT "student_subject_selections_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

