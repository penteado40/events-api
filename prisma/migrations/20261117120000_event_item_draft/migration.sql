-- AlterEnum: the Draft of the Event item (PROJ-194). In a published Event, a
-- new item is born in Draft; the items that exist stay published.
ALTER TYPE "EventItemState" ADD VALUE 'DRAFT' BEFORE 'PUBLISHED';
