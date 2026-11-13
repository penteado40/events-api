-- AlterTable
ALTER TABLE "events" ADD COLUMN     "cancelledFrom" "EventState";

-- A Cancelled Event remembers the state it goes back to; any other has none (PROJ-188).
ALTER TABLE "events" ADD CONSTRAINT "events_cancelled_from_check" CHECK (
  ("state" = 'CANCELLED' AND "cancelledFrom" IN ('DRAFT', 'PUBLISHED'))
  OR ("state" <> 'CANCELLED' AND "cancelledFrom" IS NULL)
);
