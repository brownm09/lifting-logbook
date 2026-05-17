-- CreateTable
CREATE TABLE "workout_skip_override" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "cycleNum" INTEGER NOT NULL,
    "workoutNum" INTEGER NOT NULL,
    "reason" TEXT,
    "skippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_skip_override_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workout_skip_override_userId_program_cycleNum_workoutNum_key" ON "workout_skip_override"("userId", "program", "cycleNum", "workoutNum");

-- CreateIndex
CREATE INDEX "workout_skip_override_userId_program_cycleNum_idx" ON "workout_skip_override"("userId", "program", "cycleNum");
