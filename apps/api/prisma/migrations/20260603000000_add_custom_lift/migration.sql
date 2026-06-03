-- CreateTable
CREATE TABLE "custom_lift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "movementTags" TEXT[],
    "isBodyweightComponent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_lift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_lift_userId_idx" ON "custom_lift"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_lift_userId_name_key" ON "custom_lift"("userId", "name");
