-- CreateTable
CREATE TABLE "WageRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "source" TEXT NOT NULL,
    "cateCd" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WageHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wageRunId" INTEGER NOT NULL,
    "cateCd" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "price" REAL,
    "unit" TEXT,
    "basis" TEXT,
    "description" TEXT,
    "fetchedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WageHistory_wageRunId_fkey" FOREIGN KEY ("wageRunId") REFERENCES "WageRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WageRun_source_fetchedAt_idx" ON "WageRun"("source", "fetchedAt");

-- CreateIndex
CREATE INDEX "WageRun_cateCd_idx" ON "WageRun"("cateCd");

-- CreateIndex
CREATE INDEX "WageHistory_wageRunId_idx" ON "WageHistory"("wageRunId");

-- CreateIndex
CREATE INDEX "WageHistory_jobName_idx" ON "WageHistory"("jobName");

-- CreateIndex
CREATE INDEX "WageHistory_cateCd_fetchedAt_idx" ON "WageHistory"("cateCd", "fetchedAt");
