-- CreateTable
CREATE TABLE "PhoneLoginCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneLoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhoneLoginCode_phone_createdAt_idx" ON "PhoneLoginCode"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneLoginCode_expiresAt_idx" ON "PhoneLoginCode"("expiresAt");
