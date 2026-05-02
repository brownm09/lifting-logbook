-- Per-user data source configuration.
-- adapter_config stores adapter-specific credentials (encrypted at rest per ADR-014).
-- adapter_type 'in-memory' is the default; 'sheets' and 'postgres' follow in later milestones.
CREATE TABLE IF NOT EXISTS user_data_source (
  user_id       TEXT    PRIMARY KEY,
  adapter_type  TEXT    NOT NULL DEFAULT 'in-memory',
  adapter_config JSONB
);
