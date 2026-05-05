-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "packageWeightG" DOUBLE PRECISION,
    "caloriesPer100g" DOUBLE PRECISION NOT NULL,
    "proteinPer100g" DOUBLE PRECISION NOT NULL,
    "fatPer100g" DOUBLE PRECISION NOT NULL,
    "carbsPer100g" DOUBLE PRECISION NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "isHighSugar" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductLookupLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "barcode" TEXT,
    "query" TEXT,
    "source" TEXT,
    "found" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductLookupLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "Product"("brand");

-- CreateIndex
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");

-- CreateIndex
CREATE INDEX "Product_source_idx" ON "Product"("source");

-- CreateIndex
CREATE INDEX "Product_isVerified_idx" ON "Product"("isVerified");

-- CreateIndex
CREATE INDEX "Product_isHidden_idx" ON "Product"("isHidden");

-- CreateIndex
CREATE INDEX "ProductLookupLog_userId_createdAt_idx" ON "ProductLookupLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductLookupLog_barcode_idx" ON "ProductLookupLog"("barcode");

-- CreateIndex
CREATE INDEX "ProductLookupLog_query_idx" ON "ProductLookupLog"("query");

-- CreateIndex
CREATE INDEX "ProductLookupLog_createdAt_idx" ON "ProductLookupLog"("createdAt");
