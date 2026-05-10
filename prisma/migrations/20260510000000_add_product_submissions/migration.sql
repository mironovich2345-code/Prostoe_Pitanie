-- CreateTable
CREATE TABLE "ProductSubmission" (
    "id"                   TEXT NOT NULL,
    "userId"               TEXT,
    "barcode"              TEXT,
    "name"                 TEXT NOT NULL,
    "brand"                TEXT,
    "packageWeightG"       DOUBLE PRECISION,
    "caloriesPer100g"      DOUBLE PRECISION NOT NULL,
    "proteinPer100g"       DOUBLE PRECISION NOT NULL,
    "fatPer100g"           DOUBLE PRECISION NOT NULL,
    "carbsPer100g"         DOUBLE PRECISION NOT NULL,
    "isHighSugar"          BOOLEAN NOT NULL DEFAULT false,
    "photoData"            TEXT,
    "photoStorageKey"      TEXT,
    "photoStorageProvider" TEXT,
    "status"               TEXT NOT NULL DEFAULT 'pending',
    "source"               TEXT NOT NULL DEFAULT 'user',
    "adminComment"         TEXT,
    "reviewedByUserId"     TEXT,
    "reviewedAt"           TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSubmission_status_createdAt_idx" ON "ProductSubmission"("status", "createdAt");
CREATE INDEX "ProductSubmission_userId_createdAt_idx" ON "ProductSubmission"("userId", "createdAt");
CREATE INDEX "ProductSubmission_barcode_idx" ON "ProductSubmission"("barcode");
CREATE INDEX "ProductSubmission_createdAt_idx" ON "ProductSubmission"("createdAt");
