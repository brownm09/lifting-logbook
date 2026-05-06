-- CreateTable
CREATE TABLE "workout_lift_override" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "cycleNum" INTEGER NOT NULL,
    "workoutNum" INTEGER NOT NULL,
    "lift" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "replacedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_lift_override_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workout_lift_override_userId_program_cycleNum_workoutNum_idx" ON "workout_lift_override"("userId", "program", "cycleNum", "workoutNum");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "workout_lift_override_userId_program_cycleNum_workoutNum_lift_key" ON "workout_lift_override"("userId", "program", "cycleNum", "workoutNum", "lift");
