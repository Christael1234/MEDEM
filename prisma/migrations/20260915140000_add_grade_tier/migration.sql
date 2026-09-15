-- CreateEnum
CREATE TYPE "GradeTier" AS ENUM ('NURSERY', 'LOWER_PRIMARY', 'UPPER_PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY');

-- AlterTable: add school_classes.gradeTier, backfilled from the existing
-- `level` column (1:1 for NURSERY/JUNIOR_SECONDARY/SENIOR_SECONDARY; PRIMARY
-- classes default to LOWER_PRIMARY since level alone can't disambiguate —
-- an admin corrects any that are actually upper primary via the class edit
-- UI), then locked to NOT NULL.
ALTER TABLE "school_classes" ADD COLUMN "gradeTier" "GradeTier";

UPDATE "school_classes" SET "gradeTier" = (CASE "level"::text
  WHEN 'NURSERY' THEN 'NURSERY'
  WHEN 'JUNIOR_SECONDARY' THEN 'JUNIOR_SECONDARY'
  WHEN 'SENIOR_SECONDARY' THEN 'SENIOR_SECONDARY'
  WHEN 'PRIMARY' THEN 'LOWER_PRIMARY'
END)::"GradeTier";

ALTER TABLE "school_classes" ALTER COLUMN "gradeTier" SET NOT NULL;
ALTER TABLE "school_classes" ALTER COLUMN "gradeTier" SET DEFAULT 'JUNIOR_SECONDARY';

-- AlterTable: add subjects.gradeTiers, backfilled from the existing
-- `levels` array (PRIMARY expands to both LOWER_PRIMARY and UPPER_PRIMARY,
-- preserving "applies to every primary class" for subjects already tagged
-- that way), then drop the old column.
ALTER TABLE "subjects" ADD COLUMN "gradeTiers" "GradeTier"[] NOT NULL DEFAULT ARRAY[]::"GradeTier"[];

UPDATE "subjects" SET "gradeTiers" = (
  SELECT COALESCE(ARRAY_AGG(DISTINCT tier), ARRAY[]::"GradeTier"[])
  FROM (
    SELECT (CASE lvl::text
      WHEN 'NURSERY' THEN 'NURSERY'
      WHEN 'JUNIOR_SECONDARY' THEN 'JUNIOR_SECONDARY'
      WHEN 'SENIOR_SECONDARY' THEN 'SENIOR_SECONDARY'
      WHEN 'PRIMARY' THEN 'LOWER_PRIMARY'
    END)::"GradeTier" AS tier
    FROM unnest("levels") AS lvl
    UNION ALL
    SELECT 'UPPER_PRIMARY'::"GradeTier" WHERE 'PRIMARY' = ANY("levels")
  ) expanded
);

ALTER TABLE "subjects" ALTER COLUMN "gradeTiers" DROP DEFAULT;
ALTER TABLE "subjects" DROP COLUMN "levels";
