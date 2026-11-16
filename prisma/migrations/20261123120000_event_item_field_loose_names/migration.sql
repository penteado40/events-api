-- Loose names in the people Fields (PROJ-203): an entry is a User (userId) or
-- the loose name of someone with no login (name), exactly one of the two. The
-- entries already there are all Users and stay as they are.
-- AlterTable
ALTER TABLE "event_item_field_people" ALTER COLUMN "userId" DROP NOT NULL,
ADD COLUMN "name" TEXT;

-- A User or a loose name, never both and never neither.
ALTER TABLE "event_item_field_people" ADD CONSTRAINT "event_item_field_people_user_or_name_check" CHECK (("userId" IS NULL) <> ("name" IS NULL));

-- A loose name once per Field, like a User (fieldId, userId).
CREATE UNIQUE INDEX "event_item_field_people_fieldId_name_key" ON "event_item_field_people"("fieldId", "name");
