-- The people Fields (PROJ-201): a Field of kind PEOPLE keeps its people
-- apart, one row per person, once per Field, in the order of the production
-- (position). The text Fields there are stay as they are.
-- AlterEnum
ALTER TYPE "FieldKind" ADD VALUE 'PEOPLE';

-- CreateTable
CREATE TABLE "event_item_field_people" (
    "id" SERIAL NOT NULL,
    "fieldId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER,
    "updatedById" INTEGER,

    CONSTRAINT "event_item_field_people_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_item_field_people_userId_idx" ON "event_item_field_people"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_item_field_people_fieldId_userId_key" ON "event_item_field_people"("fieldId", "userId");

-- AddForeignKey
ALTER TABLE "event_item_field_people" ADD CONSTRAINT "event_item_field_people_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_item_field_people" ADD CONSTRAINT "event_item_field_people_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_item_field_people" ADD CONSTRAINT "event_item_field_people_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "event_item_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_item_field_people" ADD CONSTRAINT "event_item_field_people_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

