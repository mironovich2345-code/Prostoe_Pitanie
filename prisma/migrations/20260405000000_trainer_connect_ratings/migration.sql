-- Add connection code fields to TrainerProfile
ALTER TABLE "TrainerProfile"
  ADD COLUMN "connectionCode"          TEXT,
  ADD COLUMN "connectionCodeExpiresAt" TIMESTAMP(3);

-- Add canViewPhotos to TrainerClientLink
ALTER TABLE "TrainerClientLink"
  ADD COLUMN "canViewPhotos" BOOLEAN NOT NULL DEFAULT true;

-- New TrainerRating table
CREATE TABLE "TrainerRating" (
  "id"         SERIAL NOT NULL,
  "trainerId"  TEXT NOT NULL,
  "clientId"   TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId"   TEXT NOT NULL,
  "rating"     TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainerRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainerRating_trainerId_clientId_targetType_targetId_key"
  ON "TrainerRating"("trainerId", "clientId", "targetType", "targetId");
