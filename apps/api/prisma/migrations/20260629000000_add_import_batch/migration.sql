-- CreateTable
CREATE TABLE "import_batch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "preImage" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_batch_userId_program_idx" ON "import_batch"("userId", "program");

-- EnableRLS
ALTER TABLE "import_batch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batch" FORCE ROW LEVEL SECURITY;
CREATE POLICY "import_batch_user_isolation" ON "import_batch"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));
