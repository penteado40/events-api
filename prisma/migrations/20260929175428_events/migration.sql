-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('WEDDING', 'BIRTHDAY', 'CORPORATE', 'BABY_SHOWER', 'PARTY', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventRole" AS ENUM ('OWNER', 'MANAGER', 'VIEWER');

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "type" "EventType" NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'ACTIVE',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "venueName" TEXT,
    "venueAddress" TEXT,
    "city" TEXT,
    "mapsUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_members" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "EventRole" NOT NULL,
    "isPrimaryOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "event_members_userId_idx" ON "event_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_members_eventId_userId_key" ON "event_members"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one Primary owner per Event, and the Primary owner is always an Owner
-- (ADR-0003). Prisma does not generate partial indexes or check constraints.
CREATE UNIQUE INDEX "event_members_one_primary_owner_per_event"
    ON "event_members"("eventId") WHERE "isPrimaryOwner";

ALTER TABLE "event_members" ADD CONSTRAINT "event_members_primary_owner_is_owner"
    CHECK (NOT "isPrimaryOwner" OR "role" = 'OWNER');
