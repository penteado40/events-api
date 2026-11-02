-- A Group that has had an Owner never goes without one again (ADR-0017, PROJ-172).
-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "hasHadOwner" BOOLEAN NOT NULL DEFAULT false;

-- Groups that already have an Owner have had one.
UPDATE "groups" SET "hasHadOwner" = true
WHERE EXISTS (
  SELECT 1 FROM "group_members" m WHERE m."groupId" = "groups"."id" AND m."role" = 'OWNER'
);
