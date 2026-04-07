-- CreateTable
CREATE TABLE "NutritionInsightCache" (
    "id" SERIAL NOT NULL,
    "chatId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "mealSignature" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionInsightCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NutritionInsightCache_chatId_period_periodKey_key" ON "NutritionInsightCache"("chatId", "period", "periodKey");
