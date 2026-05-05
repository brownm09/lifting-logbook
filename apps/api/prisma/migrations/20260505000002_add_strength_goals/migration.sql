-- CreateTable
CREATE TABLE "strength_goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "lift" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "ratio" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strength_goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "strength_goal_userId_program_idx" ON "strength_goal"("userId", "program");

-- CreateIndex
CREATE UNIQUE INDEX "strength_goal_userId_program_lift_key" ON "strength_goal"("userId", "program", "lift");
