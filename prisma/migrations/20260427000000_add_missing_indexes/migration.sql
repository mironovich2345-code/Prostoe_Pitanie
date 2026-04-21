-- Add missing indexes identified in technical audit
-- MealEntry.chatId: Telegram bot queries by chatId heavily (today's meals, diary, stats)
CREATE INDEX IF NOT EXISTS "MealEntry_chatId_idx" ON "MealEntry"("chatId");

-- WeightEntry.chatId: bot and profile routes query by chatId
CREATE INDEX IF NOT EXISTS "WeightEntry_chatId_idx" ON "WeightEntry"("chatId");

-- TrainerClientLink.clientId: reverse lookup (client → trainer) was a full table scan
-- The existing @@unique([trainerId, clientId]) only optimises trainer→client lookups
CREATE INDEX IF NOT EXISTS "TrainerClientLink_clientId_idx" ON "TrainerClientLink"("clientId");
