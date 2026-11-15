-- The Fields of an Event item (PROJ-198): a name and a value of one type
-- only. The type is kept for good in "kind", and each type keeps its value
-- apart (TEXT in "textValue"), so a new type never migrates these rows.
-- CreateEnum
CREATE TYPE "FieldKind" AS ENUM ('TEXT');

-- CreateTable
CREATE TABLE "event_item_fields" (
    "id" SERIAL NOT NULL,
    "eventItemId" INTEGER NOT NULL,
    "kind" "FieldKind" NOT NULL,
    "name" TEXT NOT NULL,
    "textValue" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER,
    "updatedById" INTEGER,

    CONSTRAINT "event_item_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_item_fields_eventItemId_idx" ON "event_item_fields"("eventItemId");

-- AddForeignKey
ALTER TABLE "event_item_fields" ADD CONSTRAINT "event_item_fields_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_item_fields" ADD CONSTRAINT "event_item_fields_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_item_fields" ADD CONSTRAINT "event_item_fields_eventItemId_fkey" FOREIGN KEY ("eventItemId") REFERENCES "event_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

