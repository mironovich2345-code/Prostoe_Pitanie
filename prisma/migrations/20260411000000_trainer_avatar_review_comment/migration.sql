-- AlterTable TrainerProfile: add avatarData
ALTER TABLE "TrainerProfile" ADD COLUMN "avatarData" TEXT;

-- AlterTable TrainerReview: add trainerComment
ALTER TABLE "TrainerReview" ADD COLUMN "trainerComment" TEXT;
