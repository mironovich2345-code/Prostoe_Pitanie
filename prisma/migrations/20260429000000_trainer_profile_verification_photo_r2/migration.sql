-- TrainerProfile: add R2 storage fields for verificationPhoto
-- Legacy records keep their verificationPhotoData (base64); new uploads go to R2.

-- R2 object key, e.g. trainer-verification-photos/{chatId}.jpg
ALTER TABLE "TrainerProfile" ADD COLUMN "verificationPhotoStorageKey" TEXT;

-- Storage provider ('r2'); NULL for legacy base64 records
ALTER TABLE "TrainerProfile" ADD COLUMN "verificationPhotoStorageProvider" TEXT;

-- Original file size in bytes; NULL for legacy records
ALTER TABLE "TrainerProfile" ADD COLUMN "verificationPhotoSizeBytes" INTEGER;
