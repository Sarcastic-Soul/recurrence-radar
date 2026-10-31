/**
 * Forge SQL schema.
 *
 * Forge SQL is MySQL-compatible (TiDB). Rules we follow:
 *  - one statement per migration
 *  - no foreign keys, no AUTO_INCREMENT (Jira issue IDs are our keys)
 *  - CREATE ... IF NOT EXISTS so re-running is safe
 *
 * The migration runner remembers which named steps already ran on each
 * installation, so `ensureSchema()` is cheap to call often.
 */
import { migrationRunner } from '@forge/sql';

const runner = migrationRunner
  .enqueue(
    'v001_create_events',
    `CREATE TABLE IF NOT EXISTS events (
      issue_id VARCHAR(32) PRIMARY KEY,
      issue_key VARCHAR(32) NOT NULL,
      project_id VARCHAR(32) NOT NULL,
      kind VARCHAR(8) NOT NULL,
      summary VARCHAR(512) NOT NULL,
      equipment VARCHAR(64),
      product VARCHAR(128),
      failure_mode VARCHAR(64),
      root_cause VARCHAR(64),
      keywords JSON,
      sop_ref VARCHAR(32),
      owner_name VARCHAR(128),
      resolver_name VARCHAR(128),
      event_date DATE NOT NULL,
      closed_date DATE,
      status VARCHAR(16) NOT NULL,
      text_hash VARCHAR(64),
      method VARCHAR(8),
      is_demo BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at DATETIME NOT NULL
    )`
  )
  .enqueue('v002_idx_events_project', 'CREATE INDEX idx_events_project ON events (project_id, kind, event_date)')
  .enqueue('v003_idx_events_equipment', 'CREATE INDEX idx_events_equipment ON events (equipment)')
  .enqueue(
    'v004_create_event_links',
    `CREATE TABLE IF NOT EXISTS event_links (
      capa_issue_id VARCHAR(32) NOT NULL,
      dev_issue_id VARCHAR(32) NOT NULL,
      PRIMARY KEY (capa_issue_id, dev_issue_id)
    )`
  )
  .enqueue(
    'v005_create_analysis',
    `CREATE TABLE IF NOT EXISTS analysis (
      issue_id VARCHAR(32) PRIMARY KEY,
      issue_key VARCHAR(32) NOT NULL,
      project_id VARCHAR(32) NOT NULL,
      level VARCHAR(8) NOT NULL,
      score DECIMAL(4,2) NOT NULL,
      body JSON NOT NULL,
      computed_at DATETIME NOT NULL
    )`
  )
  .enqueue(
    'v006_create_llm_usage',
    `CREATE TABLE IF NOT EXISTS llm_usage (
      day DATE PRIMARY KEY,
      calls INT NOT NULL
    )`
  )
  .enqueue(
    'v007_create_settings',
    `CREATE TABLE IF NOT EXISTS settings (
      k VARCHAR(64) PRIMARY KEY,
      v JSON NOT NULL
    )`
  )
  .enqueue(
    'v008_create_jobs',
    `CREATE TABLE IF NOT EXISTS jobs (
      issue_id VARCHAR(32) PRIMARY KEY,
      state VARCHAR(16) NOT NULL,
      updated_at DATETIME NOT NULL
    )`
  );

// Remember success for the life of this function instance (warm starts).
let schemaReady = null;

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = runner.run().catch((err) => {
      schemaReady = null; // allow a retry on the next call
      throw err;
    });
  }
  return schemaReady;
}
