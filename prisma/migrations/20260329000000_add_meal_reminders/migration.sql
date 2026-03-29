-- CreateTable
CREATE TABLE "MealReminder" (
    "id" SERIAL NOT NULL,
    "chatId" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MealReminder_chatId_mealType_key" ON "MealReminder"("chatId", "mealType");
