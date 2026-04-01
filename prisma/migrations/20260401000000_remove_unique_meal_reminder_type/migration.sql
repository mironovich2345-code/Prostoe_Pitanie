-- Remove unique constraint on (chatId, mealType) from MealReminder
-- This allows multiple reminders of the same type (e.g. two snack reminders)
DROP INDEX IF EXISTS "MealReminder_chatId_mealType_key";
