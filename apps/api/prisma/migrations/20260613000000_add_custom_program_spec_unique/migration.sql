-- Enforce the custom-program-spec natural key (programId, week, offset, lift, order)
-- so two concurrent Smart Imports of the same file cannot both find-then-create a
-- duplicate row (issue #488). `offset` and `order` are reserved words — quoted.

-- De-duplicate first: a UNIQUE INDEX fails if duplicates already exist. Keep the
-- lowest id per natural key and drop the rest. No-op on a clean table.
-- DESTRUCTIVE on a table that already holds duplicates: the *oldest* (lowest-id) row
-- wins, so a duplicate carrying newer config is dropped, and Prisma has no down path.
-- Verify production has zero duplicates before deploy:
--   SELECT "programId","week","offset","lift","order", count(*)
--   FROM "custom_program_spec"
--   GROUP BY 1,2,3,4,5 HAVING count(*) > 1;
DELETE FROM "custom_program_spec" a
USING "custom_program_spec" b
WHERE a."id" > b."id"
  AND a."programId" = b."programId"
  AND a."week" = b."week"
  AND a."offset" = b."offset"
  AND a."lift" = b."lift"
  AND a."order" = b."order";

-- CreateIndex
CREATE UNIQUE INDEX "custom_program_spec_programId_week_offset_lift_order_key" ON "custom_program_spec"("programId", "week", "offset", "lift", "order");
