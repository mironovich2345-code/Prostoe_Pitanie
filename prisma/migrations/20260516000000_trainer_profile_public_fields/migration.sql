-- Add public profile fields to TrainerProfile
-- publicStatus: controls catalog visibility (draft | published | hidden)
-- city, experienceYears, suitableFor, tags: public card content

ALTER TABLE "TrainerProfile" ADD COLUMN "publicStatus"    TEXT    NOT NULL DEFAULT 'draft';
ALTER TABLE "TrainerProfile" ADD COLUMN "city"            TEXT;
ALTER TABLE "TrainerProfile" ADD COLUMN "experienceYears" INTEGER;
ALTER TABLE "TrainerProfile" ADD COLUMN "suitableFor"     TEXT;
ALTER TABLE "TrainerProfile" ADD COLUMN "tags"            TEXT;
