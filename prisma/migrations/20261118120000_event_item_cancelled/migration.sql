-- AlterEnum: the Cancelled Event item (PROJ-195). A published item is
-- cancelled, frozen and still in the schedule, until uncancelled back to published.
ALTER TYPE "EventItemState" ADD VALUE 'CANCELLED';
