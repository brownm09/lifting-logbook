-- CreateTable
CREATE TABLE "lift_metadata" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lift" TEXT NOT NULL,
    "muscleGroups" TEXT[],
    "substitutions" TEXT[],
    "foundational" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "lift_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lift_metadata_userId_idx" ON "lift_metadata"("userId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "lift_metadata_userId_lift_key" ON "lift_metadata"("userId", "lift");
