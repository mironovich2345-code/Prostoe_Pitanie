-- ─── New tables: platform-independent identity + subscription ─────────────────

-- CreateTable: User
CREATE TABLE "User" (
    "id"        TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mergedAt"  TIMESTAMP(3),
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UserIdentity
CREATE TABLE "UserIdentity" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "platform"   TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "username"   TEXT,
    "firstName"  TEXT,
    "linkedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserIdentity_platform_platformId_key" ON "UserIdentity"("platform", "platformId");
CREATE UNIQUE INDEX "UserIdentity_userId_platform_key"     ON "UserIdentity"("userId", "platform");

ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: UserSubscription
CREATE TABLE "UserSubscription" (
    "id"               TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "planId"           TEXT NOT NULL,
    "status"           TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt"      TIMESTAMP(3),
    "gracePeriodEnd"   TIMESTAMP(3),
    "autoRenew"        BOOLEAN NOT NULL DEFAULT true,
    "providerSubId"    TEXT,
    "paymentProvider"  TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserSubscription_userId_key" ON "UserSubscription"("userId");

ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: Payment
CREATE TABLE "Payment" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "subscriptionId"    TEXT,
    "provider"          TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "planId"            TEXT NOT NULL,
    "amountRub"         DOUBLE PRECISION NOT NULL,
    "status"            TEXT NOT NULL,
    "periodStart"       TIMESTAMP(3),
    "periodEnd"         TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "UserSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: PaymentAttempt
CREATE TABLE "PaymentAttempt" (
    "id"               TEXT NOT NULL,
    "paymentId"        TEXT NOT NULL,
    "status"           TEXT NOT NULL,
    "providerResponse" TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: WebhookLog
CREATE TABLE "WebhookLog" (
    "id"          TEXT NOT NULL,
    "provider"    TEXT NOT NULL,
    "eventType"   TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "error"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- ─── New nullable userId columns on existing tables ────────────────────────────

-- AlterTable: UserProfile
ALTER TABLE "UserProfile"
    ADD COLUMN "userId"           TEXT,
    ADD COLUMN "referredByUserId" TEXT;

CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: TrainerProfile
ALTER TABLE "TrainerProfile" ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "TrainerProfile_userId_key" ON "TrainerProfile"("userId");

ALTER TABLE "TrainerProfile" ADD CONSTRAINT "TrainerProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: TrainerClientLink
ALTER TABLE "TrainerClientLink"
    ADD COLUMN "trainerUserId" TEXT,
    ADD COLUMN "clientUserId"  TEXT;

-- AlterTable: TrainerRating
ALTER TABLE "TrainerRating"
    ADD COLUMN "trainerUserId" TEXT,
    ADD COLUMN "clientUserId"  TEXT;

-- AlterTable: TrainerReward
ALTER TABLE "TrainerReward"
    ADD COLUMN "trainerUserId"  TEXT,
    ADD COLUMN "referredUserId" TEXT;

-- AlterTable: MealEntry
ALTER TABLE "MealEntry" ADD COLUMN "userId" TEXT;

CREATE INDEX "MealEntry_userId_idx" ON "MealEntry"("userId");

-- AlterTable: WeightEntry
ALTER TABLE "WeightEntry" ADD COLUMN "userId" TEXT;

CREATE INDEX "WeightEntry_userId_idx" ON "WeightEntry"("userId");
