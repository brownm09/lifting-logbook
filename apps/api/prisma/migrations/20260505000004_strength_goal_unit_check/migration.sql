-- AddConstraint: enforce valid unit values at the DB layer
ALTER TABLE "strength_goal"
  ADD CONSTRAINT "strength_goal_unit_check" CHECK ("unit" IN ('lbs', 'kg'));
