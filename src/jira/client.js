/**
 * Thin helpers around the Jira Cloud REST API.
 *
 * `as` is either 'app' (the app's own identity, used in background jobs) or
 * 'user' (the person looking at the page; Jira checks their permissions).
 */
import api, { route } from '@forge/api';

function client(as) {
  return as === 'user' ? api.asUser() : api.asApp();
}

async function call(as, path, options = {}) {
  const res = await client(as).requestJira(path, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (res.status === 204) return null;
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = new Error(`Jira ${options.method || 'GET'} failed (${res.status}): ${text.slice(0, 300)}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------- issues ----------

const ISSUE_FIELDS = 'summary,description,labels,project,status,created,resolutiondate,reporter,assignee,issuetype';

export function getIssue(idOrKey, as = 'app') {
  return call(as, route`/rest/api/3/issue/${idOrKey}?fields=${ISSUE_FIELDS}`);
}

/** Create up to 50 issues in one request. Returns [{id, key}] in input order. */
export async function bulkCreateIssues(issueUpdates, as = 'app') {
  const body = await call(as, route`/rest/api/3/issue/bulk`, {
    method: 'POST',
    body: JSON.stringify({ issueUpdates }),
  });
  if (body.errors && body.errors.length) {
    throw new Error(`Bulk create had errors: ${JSON.stringify(body.errors).slice(0, 400)}`);
  }
  return body.issues;
}

export function deleteIssue(idOrKey, as = 'app') {
  return call(as, route`/rest/api/3/issue/${idOrKey}?deleteSubtasks=true`, { method: 'DELETE' });
}

export function addLabels(idOrKey, labels, as = 'app') {
  return call(as, route`/rest/api/3/issue/${idOrKey}?notifyUsers=false`, {
    method: 'PUT',
    body: JSON.stringify({ update: { labels: labels.map((l) => ({ add: l })) } }),
  });
}

export function removeLabels(idOrKey, labels, as = 'app') {
  return call(as, route`/rest/api/3/issue/${idOrKey}?notifyUsers=false`, {
    method: 'PUT',
    body: JSON.stringify({ update: { labels: labels.map((l) => ({ remove: l })) } }),
  });
}

export function addComment(idOrKey, adfBody, as = 'user') {
  return call(as, route`/rest/api/3/issue/${idOrKey}/comment`, {
    method: 'POST',
    body: JSON.stringify({ body: adfBody }),
  });
}

export function setIssueProperty(idOrKey, propertyKey, value, as = 'app') {
  return call(as, route`/rest/api/3/issue/${idOrKey}/properties/${propertyKey}`, {
    method: 'PUT',
    body: JSON.stringify(value),
  });
}

export function getTransitions(idOrKey, as = 'app') {
  return call(as, route`/rest/api/3/issue/${idOrKey}/transitions`);
}

export function doTransition(idOrKey, transitionId, as = 'app') {
  return call(as, route`/rest/api/3/issue/${idOrKey}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: String(transitionId) } }),
  });
}

/** Link two issues with the built-in "Relates" type (exists on every site). */
export function linkIssues(inwardKey, outwardKey, typeName = 'Relates', as = 'app') {
  return call(as, route`/rest/api/3/issueLink`, {
    method: 'POST',
    body: JSON.stringify({
      type: { name: typeName },
      inwardIssue: { key: inwardKey },
      outwardIssue: { key: outwardKey },
    }),
  });
}

// ---------- projects ----------

export async function listProjects(as = 'user') {
  const body = await call(as, route`/rest/api/3/project/search?maxResults=100&orderBy=name`);
  return (body.values || []).map((p) => ({ id: String(p.id), key: p.key, name: p.name }));
}

export function getProject(idOrKey, as = 'app') {
  return call(as, route`/rest/api/3/project/${idOrKey}`);
}

/** Issue types available when creating issues in a project. */
export async function getCreateIssueTypes(projectIdOrKey, as = 'app') {
  const body = await call(as, route`/rest/api/3/issue/createmeta/${projectIdOrKey}/issuetypes`);
  return body.issueTypes || body.values || [];
}

export function createProject({ key, name, leadAccountId }, as = 'user') {
  return call(as, route`/rest/api/3/project`, {
    method: 'POST',
    body: JSON.stringify({
      key,
      name,
      leadAccountId,
      projectTypeKey: 'business',
      projectTemplateKey: 'com.atlassian.jira-core-project-templates:jira-core-simplified-task-tracking',
      description: 'Demo quality events created by Recurrence Radar. Safe to delete.',
      assigneeType: 'UNASSIGNED',
    }),
  });
}

export async function hasGlobalAdmin(as = 'user') {
  const body = await call(as, route`/rest/api/3/mypermissions?permissions=ADMINISTER`);
  return Boolean(body?.permissions?.ADMINISTER?.havePermission);
}

// ---------- ADF helpers ----------

/** Pull plain text out of an Atlassian Document Format value (or pass strings through). */
export function adfToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  const inner = (node.content || []).map(adfToText).join(node.type === 'doc' ? '\n' : '');
  const blocky = ['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'];
  return blocky.includes(node.type) ? `${inner}\n` : inner;
}

/** Turn plain paragraphs into a minimal ADF document. */
export function textToAdf(text) {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    type: 'doc',
    version: 1,
    content: paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })),
  };
}
