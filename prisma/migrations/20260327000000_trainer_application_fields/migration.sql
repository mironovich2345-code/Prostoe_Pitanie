-- AlterTable TrainerProfile: add application fields
ALTER TABLE "TrainerProfile" ADD COLUMN "fullName" TEXT;
ALTER TABLE "TrainerProfile" ADD COLUMN "socialLink" TEXT;
ALTER TABLE "TrainerProfile" ADD COLUMN "documentLink" TEXT;
ALTER TABLE "TrainerProfile" ADD COLUMN "appliedAt" TIMESTAMP(3);
ALTER TABLE "TrainerProfile" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "TrainerProfile" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "TrainerProfile" ADD COLUMN "blockedAt" TIMESTAMP(3);
ALTER TABLE "TrainerProfile" ADD COLUMN "verifiedByAdminId" TEXT;
ALTER TABLE "TrainerProfile" ADD COLUMN "verificationNote" TEXT;
