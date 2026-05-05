-- AlterTable: add goalType column with default "absolute", make target nullable
ALTER TABLE "strength_goal" ADD COLUMN "goalType" TEXT NOT NULL DEFAULT 'relative';
ALTER TABLE "strength_goal" ALTER COLUMN "target" DROP NOT NULL;
