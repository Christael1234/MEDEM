-- CreateTable
CREATE TABLE "grade_bands" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "minScore" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "meaning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_bands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grade_bands_tenantId_idx" ON "grade_bands"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "grade_bands_tenantId_grade_key" ON "grade_bands"("tenantId", "grade");

-- AddForeignKey
ALTER TABLE "grade_bands" ADD CONSTRAINT "grade_bands_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
