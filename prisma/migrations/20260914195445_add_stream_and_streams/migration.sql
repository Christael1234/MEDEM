-- CreateEnum
CREATE TYPE "Stream" AS ENUM ('SCIENCE', 'ART');

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "stream" "Stream";

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "streams" "Stream"[] DEFAULT ARRAY[]::"Stream"[];
