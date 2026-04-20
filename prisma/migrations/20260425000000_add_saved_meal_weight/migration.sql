-- AddColumn: SavedMeal.totalWeightG
-- Stores the total weight of the whole dish in grams.
-- Used to scale macros proportionally when a user specifies a portion size
-- smaller than the full dish. Nullable for backwards compatibility with
-- existing records (those are treated as a single serving).

ALTER TABLE "SavedMeal" ADD COLUMN "totalWeightG" DOUBLE PRECISION;
