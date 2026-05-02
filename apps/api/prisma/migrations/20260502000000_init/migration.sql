-- CreateTable
CREATE TABLE "lift_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "cycleNum" INTEGER NOT NULL,
    "workoutNum" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "lift" TEXT NOT NULL,
    "setNum" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "reps" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "lift_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_max" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "lift" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "dateUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_max_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_dashboard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "cycleUnit" TEXT NOT NULL,
    "cycleNum" INTEGER NOT NULL,
    "cycleDate" TIMESTAMP(3) NOT NULL,
    "sheetName" TEXT NOT NULL,
    "cycleStartWeekday" TEXT NOT NULL,
    "currentWeekType" TEXT NOT NULL,
    "programType" TEXT,

    CONSTRAINT "cycle_dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lift_record_userId_program_cycleNum_idx" ON "lift_record"("userId", "program", "cycleNum");

-- CreateIndex
CREATE INDEX "lift_record_userId_program_cycleNum_workoutNum_idx" ON "lift_record"("userId", "program", "cycleNum", "workoutNum");

-- CreateIndex
CREATE UNIQUE INDEX "lift_record_userId_program_cycleNum_workoutNum_lift_setNum_key" ON "lift_record"("userId", "program", "cycleNum", "workoutNum", "lift", "setNum");

-- CreateIndex
CREATE INDEX "training_max_userId_program_idx" ON "training_max"("userId", "program");

-- CreateIndex
CREATE UNIQUE INDEX "training_max_userId_program_lift_key" ON "training_max"("userId", "program", "lift");

-- CreateIndex
CREATE INDEX "cycle_dashboard_userId_program_idx" ON "cycle_dashboard"("userId", "program");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_dashboard_userId_program_key" ON "cycle_dashboard"("userId", "program");
