-- Activation links become Clerk invitations (ADR-0020, PROJ-170). The old links hold
-- hashes of tokens nothing verifies any more: they are dropped, and a new link is issued.
DELETE FROM "activation_links";

-- DropIndex
DROP INDEX "activation_links_tokenHash_key";

-- AlterTable
ALTER TABLE "activation_links" DROP COLUMN "tokenHash",
DROP COLUMN "usedAt",
ADD COLUMN     "invitationId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "activation_links_invitationId_key" ON "activation_links"("invitationId");
