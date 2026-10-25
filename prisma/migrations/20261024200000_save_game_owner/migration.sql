-- Account that created the save. Existing saves stay ownerless (shared local saves).
ALTER TABLE "SaveGame" ADD COLUMN "ownerUserId" TEXT;

-- CreateIndex
CREATE INDEX "SaveGame_ownerUserId_idx" ON "SaveGame"("ownerUserId");
