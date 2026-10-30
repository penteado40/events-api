-- The V1 event sites with Guests leave with the pivot to Groups (ADR-0016).
-- There was no data in production: the tables are dropped, not migrated.
-- Dropping a table also drops its indexes, constraints and foreign keys.

-- DropTable
DROP TABLE "api_tokens";

-- DropTable
DROP TABLE "event_members";

-- DropTable
DROP TABLE "events";

-- DropEnum
DROP TYPE "EventRole";

-- DropEnum
DROP TYPE "EventStatus";

-- DropEnum
DROP TYPE "EventType";
