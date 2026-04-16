CREATE TABLE "SavedMeal" (
    "id"           SERIAL       NOT NULL,
    "chatId"       TEXT         NOT NULL,
    "userId"       TEXT,
    "title"        TEXT         NOT NULL,
    "caloriesKcal" DOUBLE PRECISION,
    "proteinG"     DOUBLE PRECISION,
    "fatG"         DOUBLE PRECISION,
    "carbsG"       DOUBLE PRECISION,
    "fiberG"       DOUBLE PRECISION,
    "mealType"     TEXT,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedMeal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedMeal_userId_idx" ON "SavedMeal"("userId");
CREATE INDEX "SavedMeal_chatId_idx" ON "SavedMeal"("chatId");
