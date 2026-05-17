-- CreateTable
CREATE TABLE "cycle_scheduled_workout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "cycleNum" INTEGER NOT NULL,
    "workoutNum" INTEGER NOT NULL,
    "weekNum" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_scheduled_workout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cycle_scheduled_workout_userId_program_cycleNum_workoutNum_key" ON "cycle_scheduled_workout"("userId", "program", "cycleNum", "workoutNum");

-- CreateIndex
CREATE INDEX "cycle_scheduled_workout_userId_program_cycleNum_idx" ON "cycle_scheduled_workout"("userId", "program", "cycleNum");
