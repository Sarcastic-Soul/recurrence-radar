/**
 * Resolvers called from the Custom UI pages via `invoke()`.
 * They stay fast (Forge resolvers have a short timeout): slow work goes to the queue.
 */
import Resolver from '@forge/resolver';
import { buildDraftPrompt, templateDraft, toAdf } from '../core';
import {
  getAnalysis as loadAnalysis,
  getEvent,
  getEventsForProjects,
  getJobState,
  setJobState,
} from '../db/queries';
import { getSettings, saveSettings, getDemoState, setDemoState } from '../services/settings';
import { llmStatus, canUseLlm, complete } from '../services/llm';
import { enqueue } from '../services/queue';
import { buildOverview } from '../services/overview';
import { listProjects, createProject, addComment, getUserName } from '../jira/client';

const resolver = new Resolver();

// ---------- shared helpers ----------

function issueFromContext(context) {
  const issue = context?.extension?.issue;
  const project = context?.extension?.project;
  if (!issue) throw new Error('This view needs an issue context.');
  return { issueId: String(issue.id), issueKey: issue.key, projectKey: project?.key, projectId: project?.id ? String(project.id) : null };
}

/** Current analysis state for an issue, queueing a check if we have none yet. */
async function analysisState(context, { force = false } = {}) {
  const settings = await getSettings();
  const llm = await llmStatus(settings);
  const llmInfo = { available: llm.available, enabled: llm.enabled };
  const { issueId, projectKey } = issueFromContext(context);

  if (projectKey && !settings.watchedProjectKeys.includes(projectKey)) {
    return { status: 'not_tracked', llm: llmInfo, reason: 'project' };
  }
  const event = await getEvent(issueId);
  if (event && event.kind !== 'DEV') {
    return { status: 'not_tracked', llm: llmInfo, reason: event.kind };
  }

  const [analysis, job] = await Promise.all([loadAnalysis(issueId), getJobState(issueId)]);

  if (force || (!analysis && (!job || job.state === 'done' || job.state === 'error'))) {
    await setJobState(issueId, 'pending');
    await enqueue({ type: 'analyze', issueId });
    return { status: 'pending', analysis: analysis || undefined, llm: llmInfo };
  }
  if (job && job.state === 'pending') {
    // A job stuck for over 2 minutes is treated as failed so the UI can offer Re-run.
    const age = Date.now() - new Date(`${job.updatedAt.replace(' ', 'T')}Z`).getTime();
    if (age > 120000) return { status: analysis ? 'ready' : 'error', analysis: analysis || undefined, llm: llmInfo };
    return { status: 'pending', analysis: analysis || undefined, llm: llmInfo };
  }
  if (job && job.state === 'error' && !analysis) return { status: 'error', llm: llmInfo };
  return { status: 'ready', analysis, llm: llmInfo };
}

// ---------- issue panel + glance ----------

resolver.define('getAnalysis', async ({ context }) => analysisState(context));

resolver.define('runAnalysis', async ({ context }) => analysisState(context, { force: true }));

resolver.define('draftInvestigation', async ({ context }) => {
  const { issueId } = issueFromContext(context);
  const analysis = await loadAnalysis(issueId);
  if (!analysis) throw new Error('No analysis yet. Run the recurrence check first.');
  const target = await getEvent(issueId);
  const settings = await getSettings();
  const events = await getEventsForProjects([target.projectId]);

  if (await canUseLlm(settings)) {
    const text = await complete(buildDraftPrompt(target, analysis, events), { maxTokens: 900, temperature: 0.3 });
    if (text && text.trim()) return { text: text.trim(), method: 'llm' };
  }
  return { text: templateDraft(target, analysis, events), method: 'template' };
});

resolver.define('postDraft', async ({ payload, context }) => {
  const { issueKey } = issueFromContext(context);
  const text = String(payload?.text || '').trim();
  if (!text) throw new Error('Draft is empty.');
  // Posted as the app (no per-user consent needed), naming who posted it.
  const name = context?.accountId ? await getUserName(context.accountId).catch(() => null) : null;
  const by = name ? `, posted by ${name}` : '';
  const header = `Investigation draft (Recurrence Radar${by}; decision support, review before use)\n\n`;
  const res = await addComment(issueKey, toAdf(header + text), 'app');
  return { ok: true, commentId: res?.id };
});

// ---------- admin page ----------

/**
 * Settings changes are only accepted from the admin page module. Jira shows
 * that module to Jira admins only, so the app does not need to call Jira as
 * the user (which would need per-user consent) to check.
 */
const ADMIN_MODULE = 'rr-admin-page';
function isAdminContext(context) {
  return context?.moduleKey === ADMIN_MODULE || context?.extension?.type === 'jira:adminPage';
}
function requireAdmin(context) {
  if (!isAdminContext(context)) throw new Error('Only Jira admins can change Recurrence Radar settings.');
}

resolver.define('getSetup', async ({ context }) => {
  const settings = await getSettings();
  const [projects, demo, llm, isAdmin] = await Promise.all([
    listProjects('app').catch((err) => {
      console.warn('listProjects failed', err?.status, err?.message);
      return [];
    }),
    getDemoState(),
    llmStatus(settings),
    isAdminContext(context),
  ]);
  return {
    projects,
    settings,
    demo: { ...demo, loaded: demo.state === 'done' },
    llm: { available: llm.available, callsToday: llm.callsToday, cap: llm.cap, model: llm.model },
    isAdmin,
  };
});

resolver.define('seedDemo', async ({ payload, context }) => {
  requireAdmin(context);
  const demo = await getDemoState();
  if (demo.state === 'running' || demo.state === 'removing') return { ok: false, status: demo.state, message: 'Already in progress.' };
  if (demo.state === 'done') return { ok: false, status: 'done', message: 'Demo data is already loaded. Remove it first.' };

  let projectKey = payload?.projectKey;
  let projectId = null;
  const projects = await listProjects('app');

  if (payload?.createProject) {
    // Find a free project key like NWQA, NWQA2, ...
    const DEMO_NAME = 'Northwind Quality (demo)';
    const existingDemo = projects.find((p) => p.name === DEMO_NAME);
    if (existingDemo) {
      // A demo project from an earlier run is still there: reuse it.
      projectKey = existingDemo.key;
      projectId = existingDemo.id;
    } else {
      const used = new Set(projects.map((p) => p.key));
      projectKey = ['NWQA', 'NWQA2', 'NWQA3', 'NWQA4', 'NWQA5'].find((k) => !used.has(k));
      const created = await createProject({ key: projectKey, name: DEMO_NAME, leadAccountId: context.accountId }, 'app');
      projectId = String(created.id);
    }
  } else {
    const p = projects.find((x) => x.key === projectKey);
    if (!p) throw new Error('Pick a project first.');
    projectId = p.id;
  }

  await setDemoState({ state: 'running', step: 'Queued', projectKey, projectId, startedAt: new Date().toISOString() });
  await enqueue({ type: 'seed', projectId, projectKey });
  return { ok: true, status: 'running', projectKey };
});

resolver.define('removeDemo', async ({ context }) => {
  requireAdmin(context);
  const demo = await getDemoState();
  if (demo.state === 'running' || demo.state === 'removing') return { ok: false, status: demo.state };
  await setDemoState({ ...demo, state: 'removing' });
  await enqueue({ type: 'removeDemo' });
  return { ok: true, status: 'removing' };
});

resolver.define('saveSettings', async ({ payload, context }) => {
  requireAdmin(context);
  const settings = await saveSettings(payload || {});
  return { ok: true, settings };
});

// ---------- project page ----------

resolver.define('getOverview', async ({ context }) => {
  const project = context?.extension?.project;
  if (!project) throw new Error('This view needs a project context.');
  const settings = await getSettings();
  const overview = await buildOverview(String(project.id));
  return { ...overview, watched: settings.watchedProjectKeys.includes(project.key), projectKey: project.key };
});

export const resolverHandler = resolver.getDefinitions();
