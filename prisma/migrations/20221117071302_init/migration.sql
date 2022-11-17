-- CreateTable
CREATE TABLE "Poll" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pollId" TEXT NOT NULL,
    "height" INTEGER NOT NULL,
    "network" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "txHash" TEXT,
    "success" BOOLEAN NOT NULL,
    "failed" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pollId" INTEGER NOT NULL,
    "voter" TEXT NOT NULL,
    "vote" BOOLEAN NOT NULL,
    CONSTRAINT "Vote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Address" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "voterAddress" TEXT NOT NULL,
    "operatorAddress" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "userIds" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Poll_pollId_network_key" ON "Poll"("pollId", "network");
