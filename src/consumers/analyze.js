/**
 * Queue consumer: does the slow work with a long timeout.
 * Job bodies: { type: 'analyze', issueId } | { type: 'seed', projectId, projectKey } | { type: 'removeDemo' }
 */
import Resolver from '@forge/resolver';
import { analyzeIssue } from '../services/analyzer';
import { seedDemo, removeDemo } from '../services/demo';
import { setJobState } from '../db/queries';
import { ensureSchema } from '../db/schema';

const resolver = new Resolver();

resolver.define('analyze', async ({ payload }) => {
  await ensureSchema();
  const type = payload?.type || 'analyze';
  if (type === 'seed') return seedDemo(payload);
  if (type === 'removeDemo') return removeDemo();
  try {
    return await analyzeIssue(payload.issueId);
  } catch (err) {
    console.error('analyze failed', payload.issueId, err);
    await setJobState(payload.issueId, 'error').catch(() => {});
    throw err;
  }
});

export const consumerHandler = resolver.getDefinitions();
