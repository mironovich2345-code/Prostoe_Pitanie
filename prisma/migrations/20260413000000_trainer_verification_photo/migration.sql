-- AlterTable TrainerProfile: add verificationPhotoData (base64 selfie for identity check)
ALTER TABLE "TrainerProfile" ADD COLUMN "verificationPhotoData" TEXT;
