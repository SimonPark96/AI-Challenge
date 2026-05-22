-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkType_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkType" ("createdAt", "description", "id", "name") SELECT "createdAt", "description", "id", "name" FROM "WorkType";
DROP TABLE "WorkType";
ALTER TABLE "new_WorkType" RENAME TO "WorkType";
CREATE INDEX "WorkType_parentId_idx" ON "WorkType"("parentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
