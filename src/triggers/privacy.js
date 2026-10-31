/**
 * Weekly personal data report (required for apps that store account data).
 *
 * We tell Atlassian which account IDs we hold. For any account that has been
 * closed, we delete the names and IDs we stored for it.
 * https://developer.atlassian.com/cloud/jira/platform/user-privacy-developer-guide/
 */
import { privacy } from '@forge/api';
import { getStoredAccounts, forgetAccount } from '../db/queries';

const BATCH = 90; // the API accepts at most 90 accounts per call

export async function privacyTrigger() {
  try {
    const accounts = await getStoredAccounts();
    let closed = 0;
    for (let i = 0; i < accounts.length; i += BATCH) {
      const updates = (await privacy.reportPersonalData(accounts.slice(i, i + BATCH))) || [];
      for (const u of updates) {
        if (u.status === 'closed') {
          await forgetAccount(u.accountId);
          closed += 1;
        }
      }
    }
    console.log(`privacy report: ${accounts.length} accounts checked, ${closed} closed and removed`);
  } catch (err) {
    console.error('privacy report failed', err);
  }
}
