-- CreateTable
CREATE TABLE "WebLoginToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "platformUserId" TEXT,
    "platformUsername" TEXT,
    "platformName" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebLoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebLoginToken_token_key" ON "WebLoginToken"("token");

-- CreateIndex
CREATE INDEX "WebLoginToken_platform_status_idx" ON "WebLoginToken"("platform", "status");

-- CreateIndex
CREATE INDEX "WebLoginToken_expiresAt_idx" ON "WebLoginToken"("expiresAt");
