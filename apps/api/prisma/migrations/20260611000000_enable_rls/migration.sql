-- Defense-in-depth multi-tenant isolation via Postgres Row-Level Security (issue #511).
--
-- Context: every repository query already scopes by `where: { userId }` (single-layer,
-- application-level isolation). This migration adds a SECOND layer enforced by the database
-- itself, so a query that forgets the userId filter — or an injection that bypasses the ORM —
-- still cannot cross tenant boundaries. The application sets the GUC `app.current_user_id`
-- per request via a SET LOCAL (`set_config(..., true)`) issued inside the request transaction
-- (see apps/api/src/adapters/prisma/rls.interceptor.ts).
--
-- Enforcement only applies to a NON-superuser, NON-BYPASSRLS role. Superusers (and BYPASSRLS
-- roles) ignore RLS entirely, so the application must connect as `lifting_app` (created below)
-- for these policies to have any effect. Migrations themselves run as the owner/superuser and
-- are unaffected (they touch no rows).
--
-- Fail-closed: when the GUC is unset, current_setting('app.current_user_id', true) returns NULL,
-- so `"userId" = NULL` is UNKNOWN and every row is filtered out (and every INSERT is rejected by
-- WITH CHECK). Any code path that reaches a userId table without first setting the GUC therefore
-- sees zero rows rather than another tenant's data.

-- 1. Application role: non-superuser, non-BYPASSRLS. Idempotent so this migration is a no-op on
--    clusters where the role is pre-provisioned out-of-band (e.g. Cloud SQL via Terraform).
--    No password is set here (no secret in version control) — auth is configured per environment
--    (jest.global-setup.js for tests; docker-compose for local; Cloud SQL/secret for staging/prod).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lifting_app') THEN
    CREATE ROLE "lifting_app" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA "public" TO "lifting_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "public" TO "lifting_app";
-- Future tables created by later migrations (run as the owner) are auto-granted to the app role.
-- NOTE: with no FOR ROLE clause this default applies only to tables created by the role that runs
-- THIS migration. That is correct as long as every migration runs as the same owner role (the
-- documented contract, ADR-027). If a later migration is ever run by a different owner, its new
-- tables will need explicit grants, or lifting_app queries against them fail with permission denied.
ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "lifting_app";
-- All primary keys default to cuid()/uuid() generated app-side; there are no SERIAL sequences,
-- so no sequence grants are required.

-- 2. Per-table policies on the 13 tables that carry a "userId" column.
--    FORCE ROW LEVEL SECURITY so even the table owner is subject (belt-and-suspenders for any
--    environment where the owner role is not a superuser).

ALTER TABLE "lift_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lift_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY "lift_record_user_isolation" ON "lift_record"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

ALTER TABLE "training_max" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_max" FORCE ROW LEVEL SECURITY;
CREATE POLICY "training_max_user_isolation" ON "training_max"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

ALTER TABLE "cycle_dashboard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cycle_dashboard" FORCE ROW LEVEL SECURITY;
CREATE POLICY "cycle_dashboard_user_isolation" ON "cycle_dashboard"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

ALTER TABLE "training_max_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_max_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY "training_max_history_user_isolation" ON "training_max_history"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

ALTER TABLE "strength_goal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "strength_goal" FORCE ROW LEVEL SECURITY;
CREATE POLICY "strength_goal_user_isolation" ON "strength_goal"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

ALTER TABLE "workout_date_override" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workout_date_override" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workout_date_override_user_isolation" ON "workout_date_override"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

ALTER TABLE "workout_skip_override" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workout_skip_override" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workout_skip_override_user_isolation" ON "workout_skip_override"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

ALTER TABLE "workout_lift_override" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workout_lift_override" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workout_lift_override_user_isolation" ON "workout_lift_override"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

ALTER TABLE "lift_metadata" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lift_metadata" FORCE ROW LEVEL SECURITY;
CREATE POLICY "lift_metadata_user_isolation" ON "lift_metadata"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

ALTER TABLE "custom_lift" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custom_lift" FORCE ROW LEVEL SECURITY;
CREATE POLICY "custom_lift_user_isolation" ON "custom_lift"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "user_settings_user_isolation" ON "user_settings"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

ALTER TABLE "cycle_scheduled_workout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cycle_scheduled_workout" FORCE ROW LEVEL SECURITY;
CREATE POLICY "cycle_scheduled_workout_user_isolation" ON "cycle_scheduled_workout"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

ALTER TABLE "custom_program" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custom_program" FORCE ROW LEVEL SECURITY;
CREATE POLICY "custom_program_user_isolation" ON "custom_program"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));

-- 3. custom_program_spec has no "userId" column; it is owned transitively via its
--    programId FK -> custom_program."userId". Isolate it by joining to the parent program.
ALTER TABLE "custom_program_spec" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custom_program_spec" FORCE ROW LEVEL SECURITY;
CREATE POLICY "custom_program_spec_user_isolation" ON "custom_program_spec"
  USING (EXISTS (
    SELECT 1 FROM "custom_program" cp
    WHERE cp."id" = "custom_program_spec"."programId"
      AND cp."userId" = current_setting('app.current_user_id', true)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "custom_program" cp
    WHERE cp."id" = "custom_program_spec"."programId"
      AND cp."userId" = current_setting('app.current_user_id', true)));
