-- AlterTable: add referral fields to UserProfile
ALTER TABLE "UserProfile"
  ADD COLUMN "referralCode"     TEXT,
  ADD COLUMN "referredBy"       TEXT,
  ADD COLUMN "referredByRole"   TEXT,
  ADD COLUMN "referralLockedAt" TIMESTAMP(3);

-- CreateIndex: unique referral code per user
CREATE UNIQUE INDEX "UserProfile_referralCode_key" ON "UserProfile"("referralCode");
