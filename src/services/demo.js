/**
 * Demo data loader / remover.
 *
 * Creates a realistic quality history (SOPs, deviations, CAPAs) as real Jira
 * issues so judges can try the app on a fresh site with zero setup.
 * Jira cannot backdate issues, so the real event dates live in Forge SQL
 * (and are printed at the top of each description).
 *
 * Runs inside the queue consumer because it makes ~150 API calls.
 */
import { SOPS, DEVIATIONS, CAPAS } from '../demo/seed-data';
import {
  bulkCreateIssues,
  getCreateIssueTypes,
  getTransitions,
  doTransition,
  linkIssues,
  deleteIssue,
} from '../jira/client';
import { upsertEvent, addLink, getDemoEvents, deleteEvent, getEventsForProjects, getAllLinks } from '../db/queries';
import { getSettings, addWatchedProject, setDemoState, getDemoState } from './settings';
import { analyzeStoredEvent, DEMO_LABEL } from './analyzer';
import { extractRules } from '../core';

const DAY = 24 * 60 * 60 * 1000;

function daysAgoToDate(daysAgo, base) {
  if (daysAgo === null || daysAgo === undefined) return null;
  return new Date(base.getTime() - daysAgo * DAY).toISOString().slice(0, 10);
}

/**
 * Retry a Jira call a few times. Jira sometimes answers 403 "Tenant is
 * restricted" or 429/5xx for a short while; a later try usually works.
 */
async function withRetry(fn, tries = 4) {
  for (let i = 1; ; i += 1) {
    try {
      return await fn();
    } catch (err) {
      const transient = err.status === 429 || err.status >= 500 || /restricted/i.test(err.message || '');
      if (!transient || i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

/** Run async work over items, a few at a time (keeps us under Jira rate limits). */
async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

function describe(record, kind, base, settings) {
  const lines = [];
  const eventDate = daysAgoToDate(record.daysAgo, base);
  const closed = daysAgoToDate(record.closedDaysAgo, base);
  const meta = [
    kind === 'SOP' ? `Last revised: ${eventDate}` : `Event date: ${eventDate}`,
    closed && kind !== 'SOP' ? `Closed: ${closed}` : null,
    record.equipment ? `Equipment: ${record.equipment}` : null,
    record.product ? `Product: ${record.product}` : null,
    record.sopRef && kind !== 'SOP' ? `SOP: ${record.sopRef}` : null,
    record.ownerName ? `${kind === 'CAPA' ? 'CAPA owner' : 'Reported by'}: ${record.ownerName}` : null,
    record.resolverName ? `Resolved by: ${record.resolverName}` : null,
  ].filter(Boolean);

  const content = [
    { type: 'paragraph', content: [{ type: 'text', text: meta.join(' · '), marks: [{ type: 'em' }] }] },
    ...String(record.description || '')
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p.trim() }] })),
  ];
  if (record.rootCause && kind !== 'SOP') {
    content.push({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Root cause category: ', marks: [{ type: 'strong' }] },
        { type: 'text', text: record.rootCause },
      ],
    });
  }
  for (const c of record.comments || []) {
    content.push({
      type: 'paragraph',
      content: [
        { type: 'text', text: `${c.author}: `, marks: [{ type: 'strong' }] },
        { type: 'text', text: c.body },
      ],
    });
  }
  content.push({
    type: 'paragraph',
    content: [{ type: 'text', text: 'Demo record created by Recurrence Radar (fictional data).', marks: [{ type: 'em' }] }],
  });
  return { type: 'doc', version: 1, content };
}

/** Pick the "Task" issue type (or the first standard type) for a project. */
async function pickIssueType(projectId) {
  const types = await getCreateIssueTypes(projectId);
  const standard = types.filter((t) => !t.subtask);
  return (standard.find((t) => /^task$/i.test(t.name)) || standard[0]).id;
}

export async function seedDemo({ projectId, projectKey }) {
  const settings = await getSettings();
  const base = new Date();
  await setDemoState({ state: 'running', step: 'Creating issues', projectKey, projectId, startedAt: base.toISOString() });

  try {
    const issueTypeId = await pickIssueType(projectId);
    const records = [
      ...SOPS.map((r) => ({ r, kind: 'SOP', labels: [DEMO_LABEL, settings.sopLabel] })),
      ...DEVIATIONS.map((r) => ({ r, kind: 'DEV', labels: [DEMO_LABEL, 'deviation'] })),
      ...CAPAS.map((r) => ({ r, kind: 'CAPA', labels: [DEMO_LABEL, settings.capaLabel] })),
    ];

    // ----- 1. create issues, 50 per request -----
    const created = [];
    for (let i = 0; i < records.length; i += 50) {
      const chunk = records.slice(i, i + 50);
      const issues = await bulkCreateIssues(
        chunk.map(({ r, kind, labels }) => ({
          fields: {
            project: { id: String(projectId) },
            issuetype: { id: String(issueTypeId) },
            summary: r.summary.slice(0, 250),
            description: describe(r, kind, base, settings),
            labels,
          },
        }))
      );
      issues.forEach((iss, j) => created.push({ ...chunk[j], id: String(iss.id), key: iss.key }));
    }
    const byLocal = new Map(created.map((c) => [c.r.localId, c]));

    // ----- 2. store events in SQL with the real (relative) dates -----
    await setDemoState({ state: 'running', step: 'Saving history', projectKey, projectId, startedAt: base.toISOString() });
    await inBatches(created, 8, (c) =>
      upsertEvent({
        issueId: c.id,
        issueKey: c.key,
        projectId: String(projectId),
        kind: c.kind,
        summary: c.r.summary,
        equipment: c.r.equipment || null,
        product: c.r.product || null,
        failureMode: c.r.failureMode || null,
        rootCause: c.r.rootCause || null,
        keywords: keywordsFor(c.r),
        sopRef: c.r.sopRef || null,
        ownerName: c.r.ownerName || null,
        resolverName: c.r.resolverName || null,
        eventDate: daysAgoToDate(c.r.daysAgo, base),
        closedDate: c.kind === 'SOP' ? null : daysAgoToDate(c.r.closedDaysAgo, base),
        status: c.kind === 'SOP' || (c.r.closedDaysAgo !== null && c.r.closedDaysAgo !== undefined) ? 'closed' : 'open',
        textHash: null,
        method: 'rules',
        isDemo: true,
      })
    );

    // ----- 3. CAPA -> deviation links (SQL + Jira) -----
    await setDemoState({ state: 'running', step: 'Linking CAPAs', projectKey, projectId, startedAt: base.toISOString() });
    const linkPairs = [];
    for (const capa of CAPAS) {
      const c = byLocal.get(capa.localId);
      for (const devLocal of capa.linkedDeviations || []) {
        const d = byLocal.get(devLocal);
        if (c && d) linkPairs.push([c, d]);
      }
    }
    await inBatches(linkPairs, 5, async ([c, d]) => {
      await addLink(c.id, d.id);
      await withRetry(() => linkIssues(d.key, c.key)).catch((err) => console.warn('link failed', err.message));
    });

    // ----- 4. move closed records to Done (best effort) -----
    await setDemoState({ state: 'running', step: 'Closing finished records', projectKey, projectId, startedAt: base.toISOString() });
    const toClose = created.filter((c) => c.kind === 'SOP' || (c.r.closedDaysAgo !== null && c.r.closedDaysAgo !== undefined));
    if (toClose.length) {
      try {
        const { transitions = [] } = await getTransitions(toClose[0].key);
        const done = transitions.find((t) => t.to?.statusCategory?.key === 'done') || transitions.find((t) => /done|close|resolve/i.test(t.name));
        if (done) await inBatches(toClose, 5, (c) => withRetry(() => doTransition(c.key, done.id)).catch(() => null));
      } catch (err) {
        console.warn('closing demo issues failed', err.message);
      }
    }

    // ----- 5. watch the project and pre-compute analyses for every deviation -----
    await setDemoState({ state: 'running', step: 'Scoring deviations', projectKey, projectId, startedAt: base.toISOString() });
    await addWatchedProject(projectKey);
    const fresh = await getSettings();
    const [events, links] = await Promise.all([getEventsForProjects([String(projectId)]), getAllLinks()]);
    const devs = events.filter((e) => e.kind === 'DEV' && e.isDemo);
    await inBatches(devs, 8, (e) => analyzeStoredEvent(e, events, links, fresh));

    const counts = { SOP: SOPS.length, DEV: DEVIATIONS.length, CAPA: CAPAS.length };
    await setDemoState({ state: 'done', projectKey, projectId, counts, finishedAt: new Date().toISOString() });
    return counts;
  } catch (err) {
    console.error('seedDemo failed', err);
    await setDemoState({ state: 'error', projectKey, projectId, error: String(err.message || err).slice(0, 300) });
    throw err;
  }
}

export async function removeDemo() {
  const prev = await getDemoState();
  await setDemoState({ ...prev, state: 'removing' });
  const demo = await getDemoEvents();
  let deleted = 0;
  await inBatches(demo, 5, async (e) => {
    await deleteIssue(e.issueId).catch((err) => console.warn('delete failed', e.issueKey, err.message));
    await deleteEvent(e.issueId);
    deleted += 1;
  });
  await setDemoState({ state: 'none', removedAt: new Date().toISOString(), deleted });
  return deleted;
}

/** Keywords from the same extractor used for live issues, so they compare fairly. */
function keywordsFor(r) {
  return extractRules(`${r.summary}\n${r.description || ''}`).keywords || [];
}
