-- CreateEnum
CREATE TYPE "CbtExamStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CbtAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateTable
CREATE TABLE "cbt_exams" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classArmId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdByStaffProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "CbtExamStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cbt_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbt_questions" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cbt_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbt_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cbt_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbt_attempts" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "CbtAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" INTEGER,
    "totalMarks" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "cbt_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbt_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cbt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cbt_exams_tenantId_idx" ON "cbt_exams"("tenantId");

-- CreateIndex
CREATE INDEX "cbt_exams_classArmId_idx" ON "cbt_exams"("classArmId");

-- CreateIndex
CREATE INDEX "cbt_questions_examId_idx" ON "cbt_questions"("examId");

-- CreateIndex
CREATE INDEX "cbt_options_questionId_idx" ON "cbt_options"("questionId");

-- CreateIndex
CREATE INDEX "cbt_attempts_examId_idx" ON "cbt_attempts"("examId");

-- CreateIndex
CREATE INDEX "cbt_attempts_studentId_idx" ON "cbt_attempts"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "cbt_attempts_examId_studentId_key" ON "cbt_attempts"("examId", "studentId");

-- CreateIndex
CREATE INDEX "cbt_answers_attemptId_idx" ON "cbt_answers"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "cbt_answers_attemptId_questionId_key" ON "cbt_answers"("attemptId", "questionId");

-- AddForeignKey
ALTER TABLE "cbt_exams" ADD CONSTRAINT "cbt_exams_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_exams" ADD CONSTRAINT "cbt_exams_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "class_arms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_exams" ADD CONSTRAINT "cbt_exams_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_exams" ADD CONSTRAINT "cbt_exams_createdByStaffProfileId_fkey" FOREIGN KEY ("createdByStaffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_questions" ADD CONSTRAINT "cbt_questions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "cbt_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_options" ADD CONSTRAINT "cbt_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "cbt_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_attempts" ADD CONSTRAINT "cbt_attempts_examId_fkey" FOREIGN KEY ("examId") REFERENCES "cbt_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_attempts" ADD CONSTRAINT "cbt_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_answers" ADD CONSTRAINT "cbt_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "cbt_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_answers" ADD CONSTRAINT "cbt_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "cbt_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_answers" ADD CONSTRAINT "cbt_answers_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "cbt_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
