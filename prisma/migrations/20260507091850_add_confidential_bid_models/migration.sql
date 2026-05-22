-- CreateTable
CREATE TABLE "ConfidentialPrice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "unit" TEXT,
    "materialCost" REAL,
    "laborCost" REAL,
    "expenseCost" REAL,
    "totalCost" REAL,
    "sourceFile" TEXT,
    "embedding" JSONB,
    "fetchedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WorkType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WorkTypeContact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workTypeId" INTEGER NOT NULL,
    "companyName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkTypeContact_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "WorkType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BidRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quotationId" INTEGER NOT NULL,
    "workTypeId" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BidRequest_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BidRequest_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "WorkType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReceivedBid" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bidRequestId" INTEGER NOT NULL,
    "companyName" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReceivedBid_bidRequestId_fkey" FOREIGN KEY ("bidRequestId") REFERENCES "BidRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReceivedBidItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receivedBidId" INTEGER NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "spec" TEXT,
    "unit" TEXT,
    "materialCost" REAL,
    "laborCost" REAL,
    "expenseCost" REAL,
    "totalCost" REAL,
    "origItemId" INTEGER,
    "origDeviationPct" REAL,
    "matchConfidence" REAL,
    CONSTRAINT "ReceivedBidItem_receivedBidId_fkey" FOREIGN KEY ("receivedBidId") REFERENCES "ReceivedBid" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "confPriceId" INTEGER,
    "confConfidence" REAL,
    "confUnitPrice" REAL,
    "confDeviationPct" REAL,
    CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuotationItem_matchedPriceId_fkey" FOREIGN KEY ("matchedPriceId") REFERENCES "PriceHistory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuotationItem_matchedWageId_fkey" FOREIGN KEY ("matchedWageId") REFERENCES "WageHistory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuotationItem_confPriceId_fkey" FOREIGN KEY ("confPriceId") REFERENCES "ConfidentialPrice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QuotationItem" ("deviationPct", "id", "itemName", "marketPrice", "marketRegion", "matchedConfidence", "matchedPriceId", "matchedSource", "matchedWageId", "quantity", "quotationId", "rowIndex", "spec", "totalPrice", "unit", "unitPrice") SELECT "deviationPct", "id", "itemName", "marketPrice", "marketRegion", "matchedConfidence", "matchedPriceId", "matchedSource", "matchedWageId", "quantity", "quotationId", "rowIndex", "spec", "totalPrice", "unit", "unitPrice" FROM "QuotationItem";
DROP TABLE "QuotationItem";
ALTER TABLE "new_QuotationItem" RENAME TO "QuotationItem";
CREATE INDEX "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");
CREATE INDEX "QuotationItem_matchedPriceId_idx" ON "QuotationItem"("matchedPriceId");
CREATE INDEX "QuotationItem_matchedWageId_idx" ON "QuotationItem"("matchedWageId");
CREATE INDEX "QuotationItem_confPriceId_idx" ON "QuotationItem"("confPriceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ConfidentialPrice_name_idx" ON "ConfidentialPrice"("name");

-- CreateIndex
CREATE INDEX "ConfidentialPrice_fetchedAt_idx" ON "ConfidentialPrice"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkType_name_key" ON "WorkType"("name");

-- CreateIndex
CREATE INDEX "WorkTypeContact_workTypeId_idx" ON "WorkTypeContact"("workTypeId");

-- CreateIndex
CREATE INDEX "BidRequest_quotationId_idx" ON "BidRequest"("quotationId");

-- CreateIndex
CREATE INDEX "BidRequest_workTypeId_idx" ON "BidRequest"("workTypeId");

-- CreateIndex
CREATE INDEX "ReceivedBid_bidRequestId_idx" ON "ReceivedBid"("bidRequestId");

-- CreateIndex
CREATE INDEX "ReceivedBidItem_receivedBidId_idx" ON "ReceivedBidItem"("receivedBidId");
