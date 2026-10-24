-- CreateTable
CREATE TABLE "SaveHistoryChunk" (
    "saveGameId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "payloadGzip" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("saveGameId", "chunkId"),
    CONSTRAINT "SaveHistoryChunk_saveGameId_fkey" FOREIGN KEY ("saveGameId") REFERENCES "SaveGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

