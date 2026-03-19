-- CreateTable
CREATE TABLE "UserProfile" (
    "id" SERIAL NOT NULL,
    "chatId" TEXT NOT NULL,
    "heightCm" DOUBLE PRECISION,
    "currentWeightKg" DOUBLE PRECISION,
    "goalType" TEXT,
    "dailyCaloriesKcal" DOUBLE PRECISION,
    "dailyProteinG" DOUBLE PRECISION,
    "dailyFatG" DOUBLE PRECISION,
    "dailyCarbsG" DOUBLE PRECISION,
    "dailyFiberG" DOUBLE PRECISION,
    "sex" TEXT,
    "birthDate" TIMESTAMP(3),
    "activityLevel" DOUBLE PRECISION,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notificationCount" INTEGER NOT NULL DEFAULT 3,
    "notificationTimes" TEXT,
    "desiredWeightKg" DOUBLE PRECISION,
    "city" TEXT,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealEntry" (
    "id" SERIAL NOT NULL,
    "chatId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mealType" TEXT NOT NULL DEFAULT 'unknown',
    "sourceType" TEXT NOT NULL DEFAULT 'text',
    "photoFileId" TEXT,
    "voiceFileId" TEXT,
    "caloriesKcal" DOUBLE PRECISION,
    "proteinG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fiberG" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightEntry" (
    "id" SERIAL NOT NULL,
    "chatId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_chatId_key" ON "UserProfile"("chatId");
