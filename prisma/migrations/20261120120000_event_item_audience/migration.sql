-- The Audience of an Event item (PROJ-197): "Todos" (ALL), which follows the
-- list of Participants, or the people chosen (SELECTED), only among the
-- Participants. Every item there is today is "Todos", as it was born.
-- CreateEnum
CREATE TYPE "EventItemAudienceKind" AS ENUM ('ALL', 'SELECTED');

-- AlterTable
ALTER TABLE "event_items" ADD COLUMN     "audienceKind" "EventItemAudienceKind" NOT NULL DEFAULT 'ALL';

-- CreateTable
CREATE TABLE "event_item_audience_members" (
    "id" SERIAL NOT NULL,
    "eventItemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER,
    "updatedById" INTEGER,

    CONSTRAINT "event_item_audience_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_item_audience_members_userId_idx" ON "event_item_audience_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_item_audience_members_eventItemId_userId_key" ON "event_item_audience_members"("eventItemId", "userId");

-- AddForeignKey
ALTER TABLE "event_item_audience_members" ADD CONSTRAINT "event_item_audience_members_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_item_audience_members" ADD CONSTRAINT "event_item_audience_members_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_item_audience_members" ADD CONSTRAINT "event_item_audience_members_eventItemId_fkey" FOREIGN KEY ("eventItemId") REFERENCES "event_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_item_audience_members" ADD CONSTRAINT "event_item_audience_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

