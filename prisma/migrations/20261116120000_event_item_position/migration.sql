-- AlterTable: the manual order of the production (PROJ-193). The items that
-- exist keep the order they had, the order of creation.
ALTER TABLE "event_items" ADD COLUMN "position" INTEGER;
UPDATE "event_items" SET "position" = "id";
ALTER TABLE "event_items" ALTER COLUMN "position" SET NOT NULL;
