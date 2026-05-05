-- AddCheckConstraint
ALTER TABLE "training_max_history"
ADD CONSTRAINT "training_max_history_source_check"
CHECK (source IN ('test', 'program'));
