-- Every User has a phone, for contact only (PROJ-110). The Users that already
-- exist get a placeholder in E.164 that each one corrects through PATCH /me.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone" TEXT;
UPDATE "users" SET "phone" = '+5500000000000';
ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL;
