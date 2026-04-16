-- CreateTable: AiCostLog — internal AI cost telemetry, not user-facing billing
CREATE TABLE "AiCostLog" (
    "id"           SERIAL          NOT NULL,
    "userId"       TEXT,
    "chatId"       TEXT,
    "scenario"     TEXT            NOT NULL,
    "model"        TEXT            NOT NULL,
    "inputTokens"  INTEGER         NOT NULL,
    "outputTokens" INTEGER         NOT NULL,
    "totalTokens"  INTEGER         NOT NULL,
    "costUsd"      DOUBLE PRECISION NOT NULL,
    "createdAt"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCostLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiCostLog_userId_idx"    ON "AiCostLog"("userId");
CREATE INDEX "AiCostLog_chatId_idx"    ON "AiCostLog"("chatId");
CREATE INDEX "AiCostLog_scenario_idx"  ON "AiCostLog"("scenario");
CREATE INDEX "AiCostLog_createdAt_idx" ON "AiCostLog"("createdAt");
