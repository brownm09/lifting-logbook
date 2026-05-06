-- CreateTable
CREATE TABLE "workout_date_override" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "cycleNum" INTEGER NOT NULL,
    "workoutNum" INTEGER NOT NULL,
    "newDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_date_override_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workout_date_override_userId_program_cycleNum_idx" ON "workout_date_override"("userId", "program", "cycleNum");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "workout_date_override_userId_program_cycleNum_workoutNum_key" ON "workout_date_override"("userId", "program", "cycleNum", "workoutNum");
