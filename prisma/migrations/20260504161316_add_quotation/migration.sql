-- CreateTable
CREATE TABLE "Quotation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMsg" TEXT,
    "rawResponse" JSONB
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quotationId" INTEGER NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "spec" TEXT,
    "unit" TEXT,
    "quantity" REAL,
    "unitPrice" REAL,
    "totalPrice" REAL,
    "matchedPriceId" INTEGER,
    "matchedConfidence" REAL,
    "marketPrice" REAL,
    "marketRegion" TEXT,
    "deviationPct" REAL,
    CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuotationItem_matchedPriceId_fkey" FOREIGN KEY ("matchedPriceId") REFERENCES "PriceHistory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Quotation_uploadedAt_idx" ON "Quotation"("uploadedAt");

-- CreateIndex
CREATE INDEX "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");

-- CreateIndex
CREATE INDEX "QuotationItem_matchedPriceId_idx" ON "QuotationItem"("matchedPriceId");
