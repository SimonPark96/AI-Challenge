-- CreateTable
CREATE TABLE "PriceSummary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "unit" TEXT,
    "totalCost" REAL,
    "materialCost" REAL,
    "laborCost" REAL,
    "expenseCost" REAL,
    "sourceFile" TEXT,
    "sourceVia" TEXT,
    "rawRow" JSONB,
    "embedding" JSONB,
    "fetchedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quotation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMsg" TEXT,
    "rawResponse" JSONB,
    "aiCommentary" TEXT,
    "aiCommentaryAt" DATETIME,
    "priceSummaryId" INTEGER,
    CONSTRAINT "Quotation_priceSummaryId_fkey" FOREIGN KEY ("priceSummaryId") REFERENCES "PriceSummary" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Quotation" ("aiCommentary", "aiCommentaryAt", "errorMsg", "fileName", "fileSize", "id", "rawResponse", "status", "uploadedAt") SELECT "aiCommentary", "aiCommentaryAt", "errorMsg", "fileName", "fileSize", "id", "rawResponse", "status", "uploadedAt" FROM "Quotation";
DROP TABLE "Quotation";
ALTER TABLE "new_Quotation" RENAME TO "Quotation";
CREATE INDEX "Quotation_uploadedAt_idx" ON "Quotation"("uploadedAt");
CREATE INDEX "Quotation_priceSummaryId_idx" ON "Quotation"("priceSummaryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PriceSummary_name_idx" ON "PriceSummary"("name");

-- CreateIndex
CREATE INDEX "PriceSummary_fetchedAt_idx" ON "PriceSummary"("fetchedAt");
