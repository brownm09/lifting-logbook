-- CreateTable
CREATE TABLE "training_max_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "lift" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "reps" INTEGER NOT NULL DEFAULT 1,
    "date" TIMESTAMP(3) NOT NULL,
    "isPR" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "goalMet" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_max_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_max_history_userId_program_idx" ON "training_max_history"("userId", "program");

-- CreateIndex
CREATE INDEX "training_max_history_userId_program_lift_idx" ON "training_max_history"("userId", "program", "lift");
