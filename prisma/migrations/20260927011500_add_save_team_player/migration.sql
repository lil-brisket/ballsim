-- CreateTable
CREATE TABLE "SaveTeam" (
    "saveGameId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "arenaId" TEXT NOT NULL,
    "reputation" INTEGER NOT NULL,

    PRIMARY KEY ("saveGameId", "teamId"),
    CONSTRAINT "SaveTeam_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavePlayer" (
    "saveGameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "overall" INTEGER NOT NULL,
    "potentialOverall" INTEGER NOT NULL,
    "availability" TEXT NOT NULL,
    "retired" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("saveGameId", "playerId"),
    CONSTRAINT "SavePlayer_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SaveTeam_saveGameId_conferenceId_idx" ON "SaveTeam"("saveGameId", "conferenceId");

-- CreateIndex
CREATE INDEX "SaveTeam_saveGameId_name_idx" ON "SaveTeam"("saveGameId", "name");

-- CreateIndex
CREATE INDEX "SavePlayer_saveGameId_teamId_idx" ON "SavePlayer"("saveGameId", "teamId");

-- CreateIndex
CREATE INDEX "SavePlayer_saveGameId_lastName_firstName_idx" ON "SavePlayer"("saveGameId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "SavePlayer_saveGameId_position_idx" ON "SavePlayer"("saveGameId", "position");
