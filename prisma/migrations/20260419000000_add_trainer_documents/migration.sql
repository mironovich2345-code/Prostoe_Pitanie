-- CreateTable
CREATE TABLE "TrainerDocument" (
    "id" SERIAL NOT NULL,
    "chatId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "title" TEXT,
    "fileData" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainerDocument_chatId_idx" ON "TrainerDocument"("chatId");
