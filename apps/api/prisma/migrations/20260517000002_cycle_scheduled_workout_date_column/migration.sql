-- AlterTable: change scheduledDate from TIMESTAMP(3) to DATE
ALTER TABLE "cycle_scheduled_workout" ALTER COLUMN "scheduledDate" TYPE DATE USING "scheduledDate"::DATE;
