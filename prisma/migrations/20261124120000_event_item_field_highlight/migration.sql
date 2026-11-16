-- The Highlight of a Field (PROJ-200): the mark that takes it to the Summary.
-- The Fields already there are born out of it.
-- AlterTable
ALTER TABLE "event_item_fields" ADD COLUMN "highlight" BOOLEAN NOT NULL DEFAULT false;
