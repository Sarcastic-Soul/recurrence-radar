/**
 * The main pipeline: Jira issue -> extracted attributes -> stored event ->
 * recurrence analysis -> saved result + issue label/property.
 *
 * Runs inside the queue consumer (long timeout), never inside a resolver.
 */
import {
  extractRules,
  buildExtractionPrompt,
  parseExtraction,
  textHash,
  analyze,
} from '../core';
import { getIssue, adfToText, addLabels, removeLabels, setIssueProperty } from '../jira/client';
import {
  getEvent,
  upsertEvent,
  getEventsForProjects,
  getAllLinks,
  saveAnalysis,
  setJobState,
} from '../db/queries';
import { getSettings } from './settings';
import { canUseLlm, complete } from './llm';
import { listProjects } from '../jira/client';

export const HIGH_LABEL = 'recurrence-high';
export const DEMO_LABEL = 'rr-demo';
export const PROPERTY_KEY = 'recurrence-radar';
const APP_UUID = '8ed0b7f6-9b89-454e-8a68-85e9c99daf0b';
const GLANCE_STATUS_KEY = `com.atlassian.jira.issue:${APP_UUID}:rr-issue-glance:status`;

/** Decide what kind of quality record an issue is, from its labels. */
export function kindFromLabels(labels, settings) {
  const set = new Set((labels || []).map((l) => l.toLowerCase()));
  if (set.has(settings.capaLabel)) return 'CAPA';
  if (set.has(settings.sopLabel)) return 'SOP';
  return 'DEV';
}

/** Project IDs for the watched project keys. */
export async function watchedProjectIds(settings) {
  if (!settings.watchedProjectKeys.length) return [];
  const projects = await listProjects('app');
  return projects.filter((p) => settings.watchedProjectKeys.includes(p.key)).map((p) => p.id);
}

/**
 * Analyse one issue end to end.
 * Returns { status: 'ready'|'not_tracked', analysis? }.
 */
export async function analyzeIssue(issueIdOrKey) {
  const settings = await getSettings();
  const issue = await getIssue(issueIdOrKey, 'app');
  const issueId = String(issue.id);
  const fields = issue.fields;
  const projectKey = fields.project.key;

  if (!settings.watchedProjectKeys.includes(projectKey)) {
    await setJobState(issueId, 'done');
    return { status: 'not_tracked' };
  }

  const kind = kindFromLabels(fields.labels, settings);
  const existing = await getEvent(issueId);
  const description = adfToText(fields.description).trim();
  const fullText = `${fields.summary}\n${description}`;
  const hash = textHash(fullText);

  // ----- 1. extract attributes -----
  let extracted;
  let method = 'rules';
  if (existing && (existing.isDemo || existing.textHash === hash) && existing.equipment !== undefined) {
    // Demo records carry curated attributes; unchanged text keeps its earlier extraction.
    extracted = {
      equipment: existing.equipment,
      product: existing.product,
      failureMode: existing.failureMode,
      rootCause: existing.rootCause,
      keywords: existing.keywords,
    };
    method = existing.method || 'rules';
  } else if (await canUseLlm(settings)) {
    const reply = await complete(buildExtractionPrompt(fullText.slice(0, 3000)), { maxTokens: 300, temperature: 0 });
    if (reply) {
      extracted = parseExtraction(reply, fullText);
      method = 'llm';
    }
  }
  if (!extracted) extracted = extractRules(fullText);

  // ----- 2. store the event -----
  const isDone = fields.status?.statusCategory?.key === 'done';
  const event = {
    issueId,
    issueKey: issue.key,
    projectId: String(fields.project.id),
    kind,
    summary: fields.summary,
    ...extracted,
    sopRef: existing?.sopRef || findSopRef(fullText),
    ownerName: existing?.ownerName || fields.reporter?.displayName || null,
    resolverName: existing?.resolverName || (isDone ? fields.assignee?.displayName || null : null),
    eventDate: existing?.eventDate || String(fields.created).slice(0, 10),
    closedDate: existing?.isDemo ? existing.closedDate : fields.resolutiondate ? String(fields.resolutiondate).slice(0, 10) : null,
    status: existing?.isDemo ? existing.status : isDone ? 'closed' : 'open',
    textHash: hash,
    method,
    isDemo: Boolean(existing?.isDemo),
  };
  await upsertEvent(event);

  if (kind !== 'DEV') {
    await setJobState(issueId, 'done');
    return { status: 'not_tracked' };
  }

  // ----- 3. score against history -----
  const projectIds = await watchedProjectIds(settings);
  const [events, links] = await Promise.all([getEventsForProjects(projectIds), getAllLinks()]);
  const analysis = analyze(event, events, links, {
    now: new Date().toISOString(),
    threshold: settings.matchThreshold,
    method,
  });
  await saveAnalysis(event.projectId, analysis);
  await setJobState(issueId, 'done');

  // ----- 4. reflect the result on the issue (best effort) -----
  await reflectOnIssue(issue, analysis).catch((err) => console.warn('reflectOnIssue failed', err.message));
  return { status: 'ready', analysis };
}

/** Score an event we already have in SQL (used for demo seeding: no Jira reads, no LLM). */
export async function analyzeStoredEvent(event, events, links, settings) {
  const analysis = analyze(event, events, links, {
    now: new Date().toISOString(),
    threshold: settings.matchThreshold,
    method: 'rules',
  });
  await saveAnalysis(event.projectId, analysis);
  return analysis;
}

/** Label + issue property + glance lozenge so the result is visible outside the panel. */
export async function reflectOnIssue(issue, analysis) {
  const labels = issue.fields?.labels || [];
  const isHigh = analysis.level === 'HIGH';
  if (isHigh && !labels.includes(HIGH_LABEL)) await addLabels(issue.key, [HIGH_LABEL]);
  if (!isHigh && labels.includes(HIGH_LABEL)) await removeLabels(issue.key, [HIGH_LABEL]);

  await setIssueProperty(issue.key, PROPERTY_KEY, {
    level: analysis.level,
    headline: analysis.headline,
    matchCount: analysis.stats?.matchCount || 0,
    capaStatus: analysis.capa?.status || 'none',
    computedAt: analysis.computedAt,
  });

  const lozenge = {
    HIGH: { label: 'High', type: 'removed' },
    MEDIUM: { label: 'Medium', type: 'moved' },
    LOW: { label: 'Low', type: 'default' },
    NONE: { label: 'None', type: 'success' },
  }[analysis.level];
  await setIssueProperty(issue.key, GLANCE_STATUS_KEY, { type: 'lozenge', value: lozenge }).catch(() => {});
}

function findSopRef(text) {
  const m = /\bSOP[-\s]?(\d{2,4})\b/i.exec(text || '');
  return m ? `SOP-${m[1].padStart(3, '0')}` : null;
}
