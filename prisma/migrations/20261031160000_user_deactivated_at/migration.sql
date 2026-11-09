-- A Deactivated user keeps existing and is refused on every request (ADR-0020).

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deactivatedAt" TIMESTAMP(3);
