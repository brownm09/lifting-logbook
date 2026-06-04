-- Fold movement metadata into a MovementProfile (issue #427).
-- Rename the former `movementTags` column to `patterns` (preserves existing data),
-- and add the new `jointActions` and `complexity` axes.

-- AlterTable
ALTER TABLE "custom_lift" RENAME COLUMN "movementTags" TO "patterns";
ALTER TABLE "custom_lift" ADD COLUMN     "jointActions" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "custom_lift" ADD COLUMN     "complexity" TEXT NOT NULL DEFAULT 'simple';
