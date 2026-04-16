-- CreateTable: ExpertAcquisition — expert-to-expert referral system (separate from client referral)
CREATE TABLE "ExpertAcquisition" (
    "id"                    SERIAL          NOT NULL,
    "invitedExpertChatId"   TEXT            NOT NULL,
    "invitedExpertUserId"   TEXT,
    "referrerChatId"        TEXT            NOT NULL,
    "referrerUserId"        TEXT,
    "referrerType"          TEXT            NOT NULL,
    "referralCode"          TEXT            NOT NULL,
    "phase1StartsAt"        TIMESTAMP(3)    NOT NULL,
    "phase1EndsAt"          TIMESTAMP(3)    NOT NULL,
    "phase1ClientCount"     INTEGER         NOT NULL DEFAULT 0,
    "isQualified"           BOOLEAN         NOT NULL DEFAULT false,
    "qualifiedAt"           TIMESTAMP(3),
    "isActive"              BOOLEAN         NOT NULL DEFAULT true,
    "createdAt"             TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpertAcquisition_pkey" PRIMARY KEY ("id")
);

-- UniqueIndex on invitedExpertChatId (one attribution per expert)
CREATE UNIQUE INDEX "ExpertAcquisition_invitedExpertChatId_key" ON "ExpertAcquisition"("invitedExpertChatId");

-- Indexes for recruiter lookups
CREATE INDEX "ExpertAcquisition_referrerChatId_idx" ON "ExpertAcquisition"("referrerChatId");
CREATE INDEX "ExpertAcquisition_referrerUserId_idx"  ON "ExpertAcquisition"("referrerUserId");

-- AlterTable: UserProfile — store expert acquisition referral code before approval
ALTER TABLE "UserProfile" ADD COLUMN "expertReferralSourceCode" TEXT;
