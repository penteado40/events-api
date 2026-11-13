-- CreateTable
CREATE TABLE "changes" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "attribute" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "productionOnly" BOOLEAN NOT NULL,
    "reachBefore" INTEGER[],
    "reachAfter" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER,
    "updatedById" INTEGER,

    CONSTRAINT "changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "changes_eventId_createdAt_idx" ON "changes"("eventId", "createdAt");

-- AddForeignKey
ALTER TABLE "changes" ADD CONSTRAINT "changes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "changes" ADD CONSTRAINT "changes_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "changes" ADD CONSTRAINT "changes_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

