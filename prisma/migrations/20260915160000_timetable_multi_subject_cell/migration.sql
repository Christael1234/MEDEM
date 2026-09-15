-- Allows multiple subjects to share a class-arm/day/period cell (Trade
-- and Elective block periods). The staffProfileId unique index is
-- untouched and is what still guarantees no teacher is double-booked.
-- Safe with no data loss: TimetableSlot is a derived artifact fully
-- wiped and rebuilt on every TimetableService.generate() call.

-- DropIndex
DROP INDEX "timetable_slots_classArmId_dayOfWeek_periodIndex_key";

-- CreateIndex
CREATE UNIQUE INDEX "timetable_slots_classArmId_dayOfWeek_periodIndex_subjectId_key" ON "timetable_slots"("classArmId", "dayOfWeek", "periodIndex", "subjectId");
