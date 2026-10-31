/**
 * Queue consumer: does the slow work with a long timeout.
 * Job bodies: { type: 'analyze', issueId } | { type: 'seed', projectId, projectKey } | { type: 'removeDemo' }
 *
 * With @forge/events 2.x+ the consumer is a plain async function that gets
 * the pushed body on `event.body`.
 */
import { analyzeIssue } from '../services/analyzer';
import { seedDemo, removeDemo } from '../services/demo';
import { setJobState } from '../db/queries';
import { ensureSchema } from '../db/schema';

export async function consumerHandler(event) {
  const body = event?.body || {};
  await ensureSchema();
  const type = body.type || 'analyze';
  if (type === 'seed') return seedDemo(body);
  if (type === 'removeDemo') return removeDemo();
  try {
    return await analyzeIssue(body.issueId);
  } catch (err) {
    console.error('analyze failed', body.issueId, err);
    await setJobState(body.issueId, 'error').catch(() => {});
    throw err;
  }
}
