-- CreateTable: AccountLinkRequest
-- Stores one-time cross-platform account linking requests.
-- An initiator (new/second platform) creates a request and receives a short code.
-- A canonical user (existing/first platform) confirms the link using that code.
-- After confirmation the initiator's UserIdentity is reassigned to the canonical userId.

CREATE TABLE "AccountLinkRequest" (
    "id"                  TEXT NOT NULL,
    "initiatorUserId"     TEXT NOT NULL,
    "initiatorPlatform"   TEXT NOT NULL,
    "initiatorPlatformId" TEXT NOT NULL,
    "code"                TEXT NOT NULL,
    "status"              TEXT NOT NULL DEFAULT 'pending',
    "canonicalUserId"     TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"           TIMESTAMP(3) NOT NULL,
    "confirmedAt"         TIMESTAMP(3),

    CONSTRAINT "AccountLinkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountLinkRequest_code_key" ON "AccountLinkRequest"("code");
CREATE INDEX "AccountLinkRequest_initiatorUserId_status_idx" ON "AccountLinkRequest"("initiatorUserId", "status");
CREATE INDEX "AccountLinkRequest_status_expiresAt_idx" ON "AccountLinkRequest"("status", "expiresAt");
