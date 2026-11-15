-- The list of Participants of each Event (PROJ-186): born as a copy of the
-- Group members when the Event is created; who joins the Group later is not added.
-- CreateTable
CREATE TABLE "participants" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER,
    "updatedById" INTEGER,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "participants_userId_idx" ON "participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "participants_eventId_userId_key" ON "participants"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: the Events created before the list existed get every Group member
-- of now, in the order they joined, as if born with it. Written by the
-- migration, so no Author (ADR-0013).
INSERT INTO "participants" ("eventId", "userId", "createdAt", "updatedAt")
SELECT e."id", gm."userId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "events" e
JOIN "group_members" gm ON gm."groupId" = e."groupId"
ORDER BY e."id", gm."id";
