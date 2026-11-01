/**
 * Issue glance status. Jira calls this when the issue opens and again after
 * the glance panel closes, and shows the returned lozenge next to the label.
 * It only reads the saved result, so it stays fast.
 */
import { getAnalysis } from './db/queries';

const LOZENGES = {
  HIGH: { label: 'High', type: 'removed' },
  MEDIUM: { label: 'Medium', type: 'moved' },
  LOW: { label: 'Low', type: 'default' },
  NONE: { label: 'None', type: 'success' },
};

export async function glanceStatus(payload) {
  try {
    const issueId = payload?.extension?.issue?.id;
    const analysis = issueId ? await getAnalysis(String(issueId)) : null;
    const value = analysis ? LOZENGES[analysis.level] : null;
    return { status: { type: 'lozenge', value: value || { label: 'Open', type: 'default' } } };
  } catch (err) {
    console.error('glanceStatus failed', err);
    return { status: { type: 'lozenge', value: { label: 'Open', type: 'default' } } };
  }
}
