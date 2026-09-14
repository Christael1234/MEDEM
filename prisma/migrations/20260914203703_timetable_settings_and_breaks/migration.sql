-- CreateTable
CREATE TABLE "timetable_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dayStartTime" TEXT NOT NULL DEFAULT '08:00',
    "dayEndTime" TEXT NOT NULL DEFAULT '14:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_breaks" (
    "id" TEXT NOT NULL,
    "timetableSettingsId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "timetable_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "timetable_settings_tenantId_key" ON "timetable_settings"("tenantId");

-- CreateIndex
CREATE INDEX "timetable_breaks_timetableSettingsId_idx" ON "timetable_breaks"("timetableSettingsId");

-- AddForeignKey
ALTER TABLE "timetable_settings" ADD CONSTRAINT "timetable_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_breaks" ADD CONSTRAINT "timetable_breaks_timetableSettingsId_fkey" FOREIGN KEY ("timetableSettingsId") REFERENCES "timetable_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
