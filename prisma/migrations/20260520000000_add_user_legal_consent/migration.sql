-- CreateTable
CREATE TABLE "UserLegalConsent" (
    "id"                         TEXT NOT NULL,
    "userId"                     TEXT NOT NULL,
    "platform"                   TEXT,
    "source"                     TEXT NOT NULL,
    "termsVersion"               TEXT,
    "privacyVersion"             TEXT,
    "acceptedTerms"              BOOLEAN NOT NULL DEFAULT false,
    "acceptedPrivacy"            BOOLEAN NOT NULL DEFAULT false,
    "acceptedPersonalData"       BOOLEAN NOT NULL DEFAULT false,
    "acceptedMedicalDisclaimer"  BOOLEAN NOT NULL DEFAULT false,
    "acceptedSubscriptionTerms"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLegalConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserLegalConsent_userId_createdAt_idx" ON "UserLegalConsent"("userId", "createdAt");
CREATE INDEX "UserLegalConsent_userId_idx"           ON "UserLegalConsent"("userId");
CREATE INDEX "UserLegalConsent_createdAt_idx"        ON "UserLegalConsent"("createdAt");
