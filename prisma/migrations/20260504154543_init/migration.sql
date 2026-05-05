-- CreateTable
CREATE TABLE "Material" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "unit" TEXT,
    "aliases" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "source" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "fetchedAt" DATETIME NOT NULL,
    "rawHeaders" JSONB NOT NULL,
    "rawRows" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scrapeRunId" INTEGER NOT NULL,
    "materialId" INTEGER,
    "source" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "spec" TEXT,
    "unit" TEXT,
    "region" TEXT,
    "price" REAL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "extras" JSONB,
    "fetchedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_scrapeRunId_fkey" FOREIGN KEY ("scrapeRunId") REFERENCES "ScrapeRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PriceHistory_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Material_name_idx" ON "Material"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Material_name_spec_key" ON "Material"("name", "spec");

-- CreateIndex
CREATE INDEX "ScrapeRun_source_fetchedAt_idx" ON "ScrapeRun"("source", "fetchedAt");

-- CreateIndex
CREATE INDEX "ScrapeRun_keyword_idx" ON "ScrapeRun"("keyword");

-- CreateIndex
CREATE INDEX "PriceHistory_materialId_fetchedAt_idx" ON "PriceHistory"("materialId", "fetchedAt");

-- CreateIndex
CREATE INDEX "PriceHistory_source_fetchedAt_idx" ON "PriceHistory"("source", "fetchedAt");

-- CreateIndex
CREATE INDEX "PriceHistory_scrapeRunId_idx" ON "PriceHistory"("scrapeRunId");
