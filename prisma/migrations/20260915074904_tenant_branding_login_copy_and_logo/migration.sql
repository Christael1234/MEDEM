-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "loginHeadline" TEXT NOT NULL DEFAULT 'Welcome to your school portal.',
ADD COLUMN     "loginSubtext" TEXT NOT NULL DEFAULT 'Sign in to continue.',
ADD COLUMN     "logoUrl" TEXT;
