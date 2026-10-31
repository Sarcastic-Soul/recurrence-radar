/**
 * All Forge SQL reads and writes live here, so the rest of the app only
 * deals with plain JS objects (the "event" and "analysis" shapes).
 */
import { sql } from '@forge/sql';
import { ensureSchema } from './schema';

// ---------- small helpers ----------

/** Run a prepared statement and return rows (array) or the update info. */
async function run(query, params = []) {
  await ensureSchema();
  const stmt = sql.prepare(query);
  const result = params.length ? await stmt.bindParams(...params).execute() : await stmt.execute();
  return result.rows;
}

/** JSON columns can come back as strings or objects depending on the driver. */
function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Normalise DATE / DATETIME values to 'YYYY-MM-DD'. */
function toDay(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function rowToEvent(r) {
  return {
    issueId: String(r.issue_id),
    issueKey: r.issue_key,
    projectId: String(r.project_id),
    kind: r.kind,
    summary: r.summary,
    equipment: r.equipment || null,
    product: r.product || null,
    failureMode: r.failure_mode || null,
    rootCause: r.root_cause || null,
    keywords: parseJson(r.keywords, []),
    sopRef: r.sop_ref || null,
    ownerName: r.owner_name || null,
    resolverName: r.resolver_name || null,
    ownerAccountId: r.owner_account_id || null,
    resolverAccountId: r.resolver_account_id || null,
    eventDate: toDay(r.event_date),
    closedDate: toDay(r.closed_date),
    status: r.status,
    textHash: r.text_hash || null,
    method: r.method || null,
    isDemo: Boolean(Number(r.is_demo)),
  };
}

// ---------- events ----------

export async function upsertEvent(e) {
  await run(
    `INSERT INTO events (issue_id, issue_key, project_id, kind, summary, equipment, product, failure_mode,
       root_cause, keywords, sop_ref, owner_name, resolver_name, event_date, closed_date, status, text_hash,
       method, is_demo, updated_at, owner_account_id, resolver_account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE issue_key = VALUES(issue_key), project_id = VALUES(project_id), kind = VALUES(kind),
       summary = VALUES(summary), equipment = VALUES(equipment), product = VALUES(product),
       failure_mode = VALUES(failure_mode), root_cause = VALUES(root_cause), keywords = VALUES(keywords),
       sop_ref = VALUES(sop_ref), owner_name = VALUES(owner_name), resolver_name = VALUES(resolver_name),
       event_date = VALUES(event_date), closed_date = VALUES(closed_date), status = VALUES(status),
       text_hash = VALUES(text_hash), method = VALUES(method), is_demo = VALUES(is_demo),
       updated_at = VALUES(updated_at), owner_account_id = VALUES(owner_account_id),
       resolver_account_id = VALUES(resolver_account_id)`,
    [
      String(e.issueId),
      e.issueKey,
      String(e.projectId),
      e.kind,
      String(e.summary || '').slice(0, 500),
      e.equipment || null,
      e.product || null,
      e.failureMode || null,
      e.rootCause || null,
      JSON.stringify(e.keywords || []),
      e.sopRef || null,
      e.ownerName || null,
      e.resolverName || null,
      e.eventDate,
      e.closedDate || null,
      e.status || 'open',
      e.textHash || null,
      e.method || null,
      e.isDemo ? 1 : 0,
      nowSql(),
      e.ownerAccountId || null,
      e.resolverAccountId || null,
    ]
  );
}

export async function getEvent(issueId) {
  const rows = await run('SELECT * FROM events WHERE issue_id = ?', [String(issueId)]);
  return rows.length ? rowToEvent(rows[0]) : null;
}

/** All events for a set of projects (history is small per site, so we load and score in JS). */
export async function getEventsForProjects(projectIds) {
  if (!projectIds.length) return [];
  const marks = projectIds.map(() => '?').join(', ');
  const rows = await run(`SELECT * FROM events WHERE project_id IN (${marks}) ORDER BY event_date`, projectIds.map(String));
  return rows.map(rowToEvent);
}

export async function getAllEvents() {
  const rows = await run('SELECT * FROM events ORDER BY event_date');
  return rows.map(rowToEvent);
}

export async function deleteEvent(issueId) {
  await run('DELETE FROM events WHERE issue_id = ?', [String(issueId)]);
  await run('DELETE FROM analysis WHERE issue_id = ?', [String(issueId)]);
  await run('DELETE FROM event_links WHERE capa_issue_id = ? OR dev_issue_id = ?', [String(issueId), String(issueId)]);
  await run('DELETE FROM jobs WHERE issue_id = ?', [String(issueId)]);
}

export async function getDemoEvents() {
  const rows = await run('SELECT * FROM events WHERE is_demo = 1');
  return rows.map(rowToEvent);
}

// ---------- personal data (Atlassian personal data reporting) ----------

/** Every account ID we hold, with the last time we stored data for it. */
export async function getStoredAccounts() {
  const rows = await run(
    `SELECT acc, MAX(updated_at) AS updated_at FROM (
       SELECT owner_account_id AS acc, updated_at FROM events WHERE owner_account_id IS NOT NULL
       UNION ALL
       SELECT resolver_account_id AS acc, updated_at FROM events WHERE resolver_account_id IS NOT NULL
     ) t GROUP BY acc`
  );
  return rows.map((r) => ({ accountId: r.acc, updatedAt: new Date(`${String(r.updated_at).replace(' ', 'T')}Z`).toISOString() }));
}

/**
 * Remove a closed account's personal data: names and IDs on events, and any
 * saved analysis that may mention them (it is recomputed on next view).
 */
export async function forgetAccount(accountId) {
  const affected = await run(
    'SELECT issue_id, project_id FROM events WHERE owner_account_id = ? OR resolver_account_id = ?',
    [accountId, accountId]
  );
  await run('UPDATE events SET owner_name = NULL, owner_account_id = NULL WHERE owner_account_id = ?', [accountId]);
  await run('UPDATE events SET resolver_name = NULL, resolver_account_id = NULL WHERE resolver_account_id = ?', [accountId]);
  const projects = [...new Set(affected.map((r) => String(r.project_id)))];
  for (const pid of projects) await run('DELETE FROM analysis WHERE project_id = ?', [pid]);
  return affected.length;
}

// ---------- links ----------

export async function addLink(capaIssueId, devIssueId) {
  await run('INSERT IGNORE INTO event_links (capa_issue_id, dev_issue_id) VALUES (?, ?)', [
    String(capaIssueId),
    String(devIssueId),
  ]);
}

export async function getAllLinks() {
  const rows = await run('SELECT capa_issue_id, dev_issue_id FROM event_links');
  return rows.map((r) => ({ capaIssueId: String(r.capa_issue_id), devIssueId: String(r.dev_issue_id) }));
}

// ---------- analysis ----------

export async function saveAnalysis(projectId, analysis) {
  await run(
    `INSERT INTO analysis (issue_id, issue_key, project_id, level, score, body, computed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE issue_key = VALUES(issue_key), project_id = VALUES(project_id), level = VALUES(level),
       score = VALUES(score), body = VALUES(body), computed_at = VALUES(computed_at)`,
    [
      String(analysis.issueId),
      analysis.issueKey,
      String(projectId),
      analysis.level,
      Number(analysis.score || 0).toFixed(2),
      JSON.stringify(analysis),
      nowSql(),
    ]
  );
}

export async function getAnalysis(issueId) {
  const rows = await run('SELECT body FROM analysis WHERE issue_id = ?', [String(issueId)]);
  return rows.length ? parseJson(rows[0].body, null) : null;
}

export async function getAnalysesForProject(projectId) {
  const rows = await run('SELECT body FROM analysis WHERE project_id = ?', [String(projectId)]);
  return rows.map((r) => parseJson(r.body, null)).filter(Boolean);
}

// ---------- jobs (so the panel can show "checking...") ----------

export async function setJobState(issueId, state) {
  await run(
    `INSERT INTO jobs (issue_id, state, updated_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE state = VALUES(state), updated_at = VALUES(updated_at)`,
    [String(issueId), state, nowSql()]
  );
}

export async function getJobState(issueId) {
  const rows = await run('SELECT state, updated_at FROM jobs WHERE issue_id = ?', [String(issueId)]);
  if (!rows.length) return null;
  return { state: rows[0].state, updatedAt: String(rows[0].updated_at) };
}

// ---------- LLM usage counter ----------

export async function getLlmCallsToday() {
  const rows = await run('SELECT calls FROM llm_usage WHERE day = ?', [new Date().toISOString().slice(0, 10)]);
  return rows.length ? Number(rows[0].calls) : 0;
}

export async function incrementLlmCalls() {
  await run(
    `INSERT INTO llm_usage (day, calls) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE calls = calls + 1`,
    [new Date().toISOString().slice(0, 10)]
  );
}

// ---------- settings ----------

export async function getSettingValue(key) {
  const rows = await run('SELECT v FROM settings WHERE k = ?', [key]);
  return rows.length ? parseJson(rows[0].v, null) : null;
}

export async function setSettingValue(key, value) {
  await run(
    `INSERT INTO settings (k, v) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE v = VALUES(v)`,
    [key, JSON.stringify(value)]
  );
}
