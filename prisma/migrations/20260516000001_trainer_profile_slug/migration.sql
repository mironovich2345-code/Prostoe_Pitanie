-- Add slug field to TrainerProfile for public catalog URLs (/trainers/:slug)
ALTER TABLE "TrainerProfile" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "TrainerProfile_slug_key" ON "TrainerProfile"("slug");
