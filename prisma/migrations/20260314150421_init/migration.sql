-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MealEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mealType" TEXT NOT NULL DEFAULT 'unknown',
    "sourceType" TEXT NOT NULL DEFAULT 'text',
    "photoFileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_MealEntry" ("chatId", "createdAt", "id", "mealType", "text") SELECT "chatId", "createdAt", "id", "mealType", "text" FROM "MealEntry";
DROP TABLE "MealEntry";
ALTER TABLE "new_MealEntry" RENAME TO "MealEntry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
