-- AlterTable
ALTER TABLE "WageHistory" ADD COLUMN "embedding" JSONB;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QuotationItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quotationId" INTEGER NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "spec" TEXT,
    "unit" TEXT,
    "quantity" REAL,
    "unitPrice" REAL,
    "totalPrice" REAL,
    "matchedSource" TEXT,
    "matchedPriceId" INTEGER,
    "matchedWageId" INTEGER,
    "matchedConfidence" REAL,
    "marketPrice" REAL,
    "marketRegion" TEXT,
    "deviationPct" REAL,
    CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuotationItem_matchedPriceId_fkey" FOREIGN KEY ("matchedPriceId") REFERENCES "PriceHistory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuotationItem_matchedWageId_fkey" FOREIGN KEY ("matchedWageId") REFERENCES "WageHistory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QuotationItem" ("deviationPct", "id", "itemName", "marketPrice", "marketRegion", "matchedConfidence", "matchedPriceId", "quantity", "quotationId", "rowIndex", "spec", "totalPrice", "unit", "unitPrice") SELECT "deviationPct", "id", "itemName", "marketPrice", "marketRegion", "matchedConfidence", "matchedPriceId", "quantity", "quotationId", "rowIndex", "spec", "totalPrice", "unit", "unitPrice" FROM "QuotationItem";
DROP TABLE "QuotationItem";
ALTER TABLE "new_QuotationItem" RENAME TO "QuotationItem";
CREATE INDEX "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");
CREATE INDEX "QuotationItem_matchedPriceId_idx" ON "QuotationItem"("matchedPriceId");
CREATE INDEX "QuotationItem_matchedWageId_idx" ON "QuotationItem"("matchedWageId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
