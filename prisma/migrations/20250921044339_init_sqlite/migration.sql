-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageDataUrl" TEXT,
    "dateISO" TEXT,
    "tagsText" TEXT,
    "linksText" TEXT,
    "marketEnabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Project" ("dateISO", "description", "id", "imageDataUrl", "linksText", "tagsText", "title") SELECT "dateISO", "description", "id", "imageDataUrl", "linksText", "tagsText", "title" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
