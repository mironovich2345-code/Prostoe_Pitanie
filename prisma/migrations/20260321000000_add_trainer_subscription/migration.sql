-- CreateTable TrainerProfile
CREATE TABLE "TrainerProfile" (
    "id" SERIAL NOT NULL,
    "chatId" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "bio" TEXT,
    "specialization" TEXT,
    "referralCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable TrainerClientLink
CREATE TABLE "TrainerClientLink" (
    "id" SERIAL NOT NULL,
    "trainerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "fullHistoryAccess" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "TrainerClientLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable Subscription
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "chatId" TEXT NOT NULL,
    "planId" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'trial',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable TrainerReward
CREATE TABLE "TrainerReward" (
    "id" SERIAL NOT NULL,
    "trainerId" TEXT NOT NULL,
    "referredChatId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amountRub" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending_hold',
    "holdUntil" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainerProfile_chatId_key" ON "TrainerProfile"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerProfile_referralCode_key" ON "TrainerProfile"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerClientLink_trainerId_clientId_key" ON "TrainerClientLink"("trainerId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_chatId_key" ON "Subscription"("chatId");
