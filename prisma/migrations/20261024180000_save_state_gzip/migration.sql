-- Compressed GameState snapshot. Rows written before this keep stateJson until their next save.
ALTER TABLE "SaveGame" ADD COLUMN "stateGzip" BLOB;
