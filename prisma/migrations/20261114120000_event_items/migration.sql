-- CreateEnum
CREATE TYPE "EventItemState" AS ENUM ('PUBLISHED');

-- CreateTable
CREATE TABLE "event_items" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE,
    "time" VARCHAR(5),
    "placeName" TEXT,
    "placeAddress" TEXT,
    "placeTimezone" TEXT,
    "state" "EventItemState" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER,
    "updatedById" INTEGER,

    CONSTRAINT "event_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_items_eventId_idx" ON "event_items"("eventId");

-- AddForeignKey
ALTER TABLE "event_items" ADD CONSTRAINT "event_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_items" ADD CONSTRAINT "event_items_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_items" ADD CONSTRAINT "event_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The time is only the start's, and only with a date (CONTEXT.md, Event item).
ALTER TABLE "event_items" ADD CONSTRAINT "event_items_time_needs_date" CHECK ("time" IS NULL OR "date" IS NOT NULL);
