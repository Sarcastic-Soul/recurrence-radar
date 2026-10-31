/**
 * Jira issue created/updated trigger.
 * Keep it fast: decide if the issue matters, then hand off to the queue.
 */
import { enqueue } from '../services/queue';
import { getSettings } from '../services/settings';
import { setJobState } from '../db/queries';
import { DEMO_LABEL } from '../services/analyzer';

const TEXT_FIELDS = new Set(['summary', 'description', 'labels', 'status', 'resolution']);

export async function issueTrigger(event) {
  try {
    const issue = event.issue;
    if (!issue) return;
    const labels = issue.fields?.labels || [];
    if (labels.includes(DEMO_LABEL) && event.eventType === 'avi:jira:created:issue') return; // demo loader scores these itself

    if (event.eventType === 'avi:jira:updated:issue') {
      // Our own label/property writes also fire "updated"; only react to real content changes.
      const items = event.changelog?.items || [];
      const relevant = items.some((i) => TEXT_FIELDS.has(String(i.field).toLowerCase()) && !String(i.toString || '').includes('recurrence-high'));
      if (!relevant) return;
    }

    const settings = await getSettings();
    const projectKey = issue.fields?.project?.key;
    if (!projectKey || !settings.watchedProjectKeys.includes(projectKey)) return;

    await setJobState(issue.id, 'pending');
    await enqueue({ type: 'analyze', issueId: String(issue.id) });
  } catch (err) {
    console.error('issueTrigger failed', err);
  }
}
