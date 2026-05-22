-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BidRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quotationId" INTEGER,
    "workTypeId" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BidRequest_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BidRequest_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "WorkType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BidRequest" ("createdAt", "description", "id", "quotationId", "sentAt", "status", "title", "workTypeId") SELECT "createdAt", "description", "id", "quotationId", "sentAt", "status", "title", "workTypeId" FROM "BidRequest";
DROP TABLE "BidRequest";
ALTER TABLE "new_BidRequest" RENAME TO "BidRequest";
CREATE INDEX "BidRequest_quotationId_idx" ON "BidRequest"("quotationId");
CREATE INDEX "BidRequest_workTypeId_idx" ON "BidRequest"("workTypeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
