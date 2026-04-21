-- TrainerDocument: add R2 storage fields and make fileData nullable
-- Legacy records keep their fileData; new records write to R2 and leave fileData NULL.

-- Make fileData nullable (existing base64 data is preserved)
ALTER TABLE "TrainerDocument" ALTER COLUMN "fileData" DROP NOT NULL;

-- R2 object key, e.g. trainer-documents/{chatId}/{id}.pdf
ALTER TABLE "TrainerDocument" ADD COLUMN "storageKey" TEXT;

-- Storage provider ('r2'); NULL for legacy base64 records
ALTER TABLE "TrainerDocument" ADD COLUMN "storageProvider" TEXT;

-- Original file size in bytes; NULL for legacy records
ALTER TABLE "TrainerDocument" ADD COLUMN "sizeBytes" INTEGER;
