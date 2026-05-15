-- CreateTable
CREATE TABLE "ExpertApplication" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'pending',
    "fullName"        TEXT NOT NULL,
    "specialization"  TEXT NOT NULL,
    "city"            TEXT,
    "workFormat"      TEXT,
    "experienceYears" INTEGER,
    "socialLink"      TEXT,
    "bio"             TEXT NOT NULL,
    "proofLink"       TEXT,
    "source"          TEXT NOT NULL DEFAULT 'web',
    "adminComment"    TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertApplication_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExpertApplication" ADD CONSTRAINT "ExpertApplication_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ExpertApplication_userId_idx" ON "ExpertApplication"("userId");

-- CreateIndex
CREATE INDEX "ExpertApplication_status_idx" ON "ExpertApplication"("status");

-- CreateIndex
CREATE INDEX "ExpertApplication_createdAt_idx" ON "ExpertApplication"("createdAt");
