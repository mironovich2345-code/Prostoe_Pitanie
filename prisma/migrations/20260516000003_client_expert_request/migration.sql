-- CreateTable
CREATE TABLE "ClientExpertRequest" (
    "id"               TEXT NOT NULL,
    "clientUserId"     TEXT NOT NULL,
    "expertUserId"     TEXT,
    "trainerProfileId" INTEGER NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'pending',
    "message"          TEXT,
    "source"           TEXT NOT NULL DEFAULT 'web',
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    "respondedAt"      TIMESTAMP(3),

    CONSTRAINT "ClientExpertRequest_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex (one active request per client-trainer pair)
CREATE UNIQUE INDEX "ClientExpertRequest_clientUserId_trainerProfileId_key"
    ON "ClientExpertRequest"("clientUserId", "trainerProfileId");

-- CreateIndex
CREATE INDEX "ClientExpertRequest_clientUserId_idx"     ON "ClientExpertRequest"("clientUserId");
CREATE INDEX "ClientExpertRequest_expertUserId_idx"     ON "ClientExpertRequest"("expertUserId");
CREATE INDEX "ClientExpertRequest_trainerProfileId_idx" ON "ClientExpertRequest"("trainerProfileId");
CREATE INDEX "ClientExpertRequest_status_idx"           ON "ClientExpertRequest"("status");
CREATE INDEX "ClientExpertRequest_createdAt_idx"        ON "ClientExpertRequest"("createdAt");
