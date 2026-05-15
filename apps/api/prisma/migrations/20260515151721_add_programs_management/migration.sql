-- CreateTable
CREATE TABLE "user_settings" (
    "userId" TEXT NOT NULL,
    "activeProgram" TEXT,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "custom_program" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_program_spec" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "offset" INTEGER NOT NULL DEFAULT 0,
    "lift" TEXT NOT NULL,
    "increment" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "amrap" BOOLEAN NOT NULL DEFAULT false,
    "warmUpPct" TEXT NOT NULL,
    "wtDecrementPct" DOUBLE PRECISION NOT NULL,
    "activation" TEXT NOT NULL,
    "weekType" TEXT,

    CONSTRAINT "custom_program_spec_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_program_userId_idx" ON "custom_program"("userId");

-- CreateIndex
CREATE INDEX "custom_program_spec_programId_idx" ON "custom_program_spec"("programId");

-- AddForeignKey
ALTER TABLE "custom_program_spec" ADD CONSTRAINT "custom_program_spec_programId_fkey" FOREIGN KEY ("programId") REFERENCES "custom_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "workout_lift_override_userId_program_cycleNum_workoutNum_lift_k" RENAME TO "workout_lift_override_userId_program_cycleNum_workoutNum_li_key";
