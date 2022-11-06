-- CreateTable
CREATE TABLE "Vote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "chain" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "height" INTEGER NOT NULL,
    "voter" TEXT NOT NULL,
    "vote" BOOLEAN NOT NULL DEFAULT false,
    "network" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Address" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "address" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "userIds" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "pollId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "network" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Vote_pollId_txHash_height_voter_network_key" ON "Vote"("pollId", "txHash", "height", "voter", "network");
