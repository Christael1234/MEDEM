-- CreateTable
CREATE TABLE "timetable_slots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classArmId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "periodIndex" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timetable_slots_tenantId_idx" ON "timetable_slots"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_slots_classArmId_dayOfWeek_periodIndex_key" ON "timetable_slots"("classArmId", "dayOfWeek", "periodIndex");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_slots_staffProfileId_dayOfWeek_periodIndex_key" ON "timetable_slots"("staffProfileId", "dayOfWeek", "periodIndex");

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "class_arms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
