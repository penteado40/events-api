-- A Team name is unique per Group ignoring case ("Banda" and "banda" collide).
-- Prisma cannot model an expression index in schema.prisma, so it lives only here;
-- the case-sensitive "teams_groupId_name_key" stays, as the schema still declares it.
-- CreateIndex
CREATE UNIQUE INDEX "teams_groupId_lower_name_key" ON "teams"("groupId", lower("name"));
