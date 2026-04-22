-- MealEntry: add R2 storage fields for meal photos
-- Legacy records keep their photoData (base64); new photo uploads go to R2.

-- R2 object key, e.g. meal-photos/{chatId}/{timestamp}.jpg
ALTER TABLE "MealEntry" ADD COLUMN "photoStorageKey" TEXT;

-- Storage provider ('r2'); NULL for legacy base64 records
ALTER TABLE "MealEntry" ADD COLUMN "photoStorageProvider" TEXT;

-- Original file size in bytes; NULL for legacy records
ALTER TABLE "MealEntry" ADD COLUMN "photoSizeBytes" INTEGER;
