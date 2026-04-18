-- CreateTable: PayoutRequest
-- Stores trainer/company-initiated withdrawal requests.
-- When a request is created, the covered TrainerReward rows move to status='requested'
-- and get payoutRequestId set so they cannot be double-claimed.
-- On admin approval (paid): rewards move to paid_out.
-- On cancellation: rewards revert to available.

CREATE TABLE "PayoutRequest" (
    "id"                  SERIAL          NOT NULL,
    "trainerId"           TEXT            NOT NULL,
    "trainerUserId"       TEXT,
    "amountRub"           DOUBLE PRECISION NOT NULL,
    "requisitesSnapshot"  TEXT            NOT NULL,
    "rewardIds"           TEXT            NOT NULL,
    "status"              TEXT            NOT NULL DEFAULT 'pending',
    "note"                TEXT,
    "createdAt"           TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayoutRequest_trainerId_idx" ON "PayoutRequest"("trainerId");
CREATE INDEX "PayoutRequest_trainerUserId_idx" ON "PayoutRequest"("trainerUserId");
CREATE INDEX "PayoutRequest_status_idx" ON "PayoutRequest"("status");

-- AlterTable: add payoutRequestId to TrainerReward for idempotent linking
ALTER TABLE "TrainerReward" ADD COLUMN "payoutRequestId" INTEGER;
