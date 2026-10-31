// Thin wrapper around @forge/bridge. Inside Jira every call goes to the real
// resolver. Outside Forge (npm run dev, no window.__bridge) calls go to a
// mock module that is loaded on demand, so it never runs inside Jira.
// Mock data is only ever used on a local dev server, never on a deployed page.
export const inForge = !/^(localhost|127\.0\.0\.1)$/.test(globalThis.location?.hostname || '');

// @forge/bridge touches the host bridge as soon as it loads, so it is only
// imported inside Forge. Outside Forge the mock module is imported instead.
let bridgePromise;
const bridge = () => (bridgePromise ||= import('@forge/bridge'));

let mockPromise;
const loadMock = () => (mockPromise ||= import('./mock.js'));

export async function call(name, payload) {
  if (inForge) return (await bridge()).invoke(name, payload);
  const { mockInvoke } = await loadMock();
  return mockInvoke(name, payload);
}

export const api = {
  getAnalysis: () => call('getAnalysis'),
  runAnalysis: () => call('runAnalysis'),
  draftInvestigation: () => call('draftInvestigation'),
  postDraft: (text) => call('postDraft', { text }),
  getSetup: () => call('getSetup'),
  seedDemo: (payload) => call('seedDemo', payload),
  removeDemo: () => call('removeDemo'),
  saveSettings: (settings) => call('saveSettings', settings),
  getOverview: () => call('getOverview'),
};

export async function getContext() {
  if (inForge) return (await bridge()).view.getContext();
  const { mockContext } = await loadMock();
  return mockContext;
}

// Enables Atlassian design tokens (light + dark). Outside Forge, or if the
// theme call fails, the page falls back to the token values in styles.css.
export async function enableTheme() {
  const root = document.documentElement;
  if (inForge) {
    try {
      await (await bridge()).view.theme.enable();
      return;
    } catch {
      // fall through to local token values
    }
  }
  root.classList.add('rr-local-tokens');
  const q = new URLSearchParams(location.search).get('theme');
  const dark = q ? q === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.setAttribute('data-color-mode', dark ? 'dark' : 'light');
}

export async function onIssueChanged(callback) {
  if (!inForge) return () => {};
  try {
    const sub = await (await bridge()).events.on('JIRA_ISSUE_CHANGED', callback);
    return () => sub?.unsubscribe?.();
  } catch {
    return () => {};
  }
}

export function openIssue(issueKey, newTab = false) {
  const path = `/browse/${issueKey}`;
  if (!inForge) {
    // eslint-disable-next-line no-console
    console.info(`[mock] would open ${path}`);
    return;
  }
  bridge().then(({ router }) => (newTab ? router.open(path) : router.navigate(path)).catch(() => router.open(path)));
}

export function openPath(path) {
  if (!inForge) {
    console.info(`[mock] would open ${path}`);
    return;
  }
  bridge().then(({ router }) => router.navigate(path).catch(() => router.open(path)));
}

let flagId = 0;
export function flag({ title, description, type = 'success' }) {
  if (!inForge) {
    console.info(`[mock flag:${type}] ${title}${description ? ` — ${description}` : ''}`);
    window.dispatchEvent(new CustomEvent('rr-mock-flag', { detail: { title, description, type } }));
    return;
  }
  const id = `rr-${Date.now()}-${flagId++}`;
  bridge()
    .then(({ showFlag }) => showFlag({ id, title, description, type, isAutoDismiss: true }))
    .catch(() => {
      // flags are best effort
    });
}

export function errorMessage(err) {
  if (!err) return 'Something went wrong.';
  if (typeof err === 'string') return err;
  return err.message || 'Something went wrong.';
}
