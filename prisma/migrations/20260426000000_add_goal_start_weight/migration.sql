-- AddColumns: UserProfile.goalStartWeightKg, UserProfile.goalStartedAt
-- goalStartWeightKg stores the user's current weight at the moment they set their
-- desiredWeightKg (goal target). Used as a stable anchor for progress calculation
-- so the progress bar doesn't shift as new weight entries push old ones off the
-- 10-entry window. Nullable: null for existing users until they next update their goal.

ALTER TABLE "UserProfile" ADD COLUMN "goalStartWeightKg" DOUBLE PRECISION;
ALTER TABLE "UserProfile" ADD COLUMN "goalStartedAt" TIMESTAMP(3);
