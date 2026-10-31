// Mock resolver used only when the page runs outside Forge (npm run dev).
// Shapes follow CONTRACT.md. Pick a state with ?state=... in the URL:
//   panel/glance: ready (default) | pending | recheck | not_tracked | capa | error | low | effective | open | none
//   admin:        default | loaded | running
//   overview:     default | empty | unwatched

const params = new URLSearchParams(globalThis.location?.search || '');
const STATE = params.get('state') || 'ready';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const HERO_MATCHES = [
  {
    issueId: '10141',
    issueKey: 'QMS-41',
    summary: 'Tablet weight drift on Press 4 after punch change, batch B2207',
    eventDate: '2026-09-18',
    status: 'closed',
    sim: 0.86,
    reasons: [
      { type: 'equipment', label: 'Press 4' },
      { type: 'failureMode', label: 'Weight variation' },
      { type: 'product', label: 'Metformin 500 mg' },
      { type: 'keywords', label: 'compression, punch' },
    ],
    rootCause: 'Tooling wear',
    resolverName: 'Ravi Patel',
  },
  {
    issueId: '10130',
    issueKey: 'QMS-30',
    summary: 'Low tablet weight on Press 4, IPC check failed at 40 min',
    eventDate: '2026-06-03',
    status: 'closed',
    sim: 0.79,
    reasons: [
      { type: 'equipment', label: 'Press 4' },
      { type: 'failureMode', label: 'Weight variation' },
      { type: 'rootCause', label: 'Tooling wear' },
    ],
    rootCause: 'Tooling wear',
    resolverName: 'Ravi Patel',
  },
  {
    issueId: '10117',
    issueKey: 'QMS-17',
    summary: 'Weight variation out of limits during compression of Metformin',
    eventDate: '2026-02-20',
    status: 'closed',
    sim: 0.71,
    reasons: [
      { type: 'failureMode', label: 'Weight variation' },
      { type: 'product', label: 'Metformin 500 mg' },
      { type: 'keywords', label: 'compression' },
    ],
    rootCause: 'Feed frame speed',
    resolverName: 'Ana Lopes',
  },
];

const HERO = {
  issueId: '10148',
  issueKey: 'QMS-48',
  level: 'HIGH',
  score: 0.86,
  method: 'llm',
  computedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  extracted: {
    equipment: 'Press 4',
    product: 'Metformin 500 mg tablets',
    failureMode: 'Weight variation',
    rootCause: null,
    keywords: ['tablet', 'weight', 'compression', 'batch'],
  },
  headline: 'QMS-31 closed 12 Mar 2026. 2 recurrences since. Likely ineffective.',
  matches: HERO_MATCHES,
  stats: { matchCount: 3, last12Months: 3, windowMonths: 12, firstDate: '2026-02-20', lastDate: '2026-09-18' },
  capa: {
    status: 'likely_ineffective',
    issueKey: 'QMS-31',
    issueId: '10131',
    summary: 'Replace worn upper punches on Press 4 and add punch-length check',
    closedDate: '2026-03-12',
    ownerName: 'Priya Natarajan',
    recurrencesSince: 2,
    sinceKeys: ['QMS-30', 'QMS-41'],
  },
  experts: [
    { name: 'Ravi Patel', points: 6, resolved: 2, capaOwned: 0, of: 3 },
    { name: 'Priya Natarajan', points: 2, resolved: 0, capaOwned: 1, of: 3 },
    { name: 'Ana Lopes', points: 2, resolved: 1, capaOwned: 0, of: 3 },
  ],
  sop: { sopRef: 'SOP-012', title: 'Tablet compression', lastRevised: '2025-11-02', count: 3, issueKey: 'QMS-3' },
};

function variant(state) {
  if (state === 'low') {
    return {
      ...HERO,
      level: 'LOW',
      score: 0.48,
      method: 'rules',
      headline: 'One loosely similar event in the last 12 months.',
      matches: [{ ...HERO_MATCHES[2], sim: 0.48, reasons: [{ type: 'keywords', label: 'compression' }] }],
      stats: { matchCount: 1, last12Months: 1, windowMonths: 12, firstDate: '2026-02-20', lastDate: '2026-02-20' },
      capa: { status: 'none' },
      experts: [HERO.experts[2]],
      sop: null,
    };
  }
  if (state === 'none') {
    return {
      ...HERO,
      level: 'NONE',
      score: 0.12,
      method: 'rules',
      headline: 'No similar events in the last 12 months.',
      matches: [],
      stats: { matchCount: 0, last12Months: 0, windowMonths: 12, firstDate: null, lastDate: null },
      capa: { status: 'none' },
      experts: [],
      sop: null,
    };
  }
  if (state === 'effective') {
    return {
      ...HERO,
      level: 'MEDIUM',
      score: 0.64,
      headline: 'Seen twice before. QMS-22 closed 4 Jul 2026 with no repeat since.',
      matches: HERO_MATCHES.slice(1),
      stats: { matchCount: 2, last12Months: 2, windowMonths: 12, firstDate: '2026-02-20', lastDate: '2026-06-03' },
      capa: {
        status: 'effective',
        issueKey: 'QMS-22',
        issueId: '10122',
        summary: 'Retrain operators on IPC weight checks',
        closedDate: '2026-07-04',
        ownerName: 'Priya Natarajan',
        recurrencesSince: 0,
        sinceKeys: [],
      },
    };
  }
  if (state === 'open') {
    return {
      ...HERO,
      level: 'MEDIUM',
      score: 0.66,
      headline: 'Seen 3 times in 12 months. CAPA QMS-44 is still open.',
      capa: {
        status: 'open',
        issueKey: 'QMS-44',
        issueId: '10144',
        summary: 'Install punch-length gauge on Press 4',
        closedDate: null,
        ownerName: 'Priya Natarajan',
        recurrencesSince: 0,
        sinceKeys: [],
      },
    };
  }
  return HERO;
}

let pendingCalls = 0;

const DRAFT = `## Problem statement
Tablet weight out of specification on Press 4 during compression of Metformin 500 mg tablets, batch B2291. This is the 4th weight variation event on Press 4 in 12 months.

## Prior events
- QMS-41 (18 Sep 2026): weight drift after punch change. Root cause: tooling wear. Resolved by Ravi Patel.
- QMS-30 (3 Jun 2026): low tablet weight, IPC check failed. Root cause: tooling wear. Resolved by Ravi Patel.
- QMS-17 (20 Feb 2026): weight variation out of limits. Root cause: feed frame speed. Resolved by Ana Lopes.

## Earlier root causes
Tooling wear (2 of 3), feed frame speed (1 of 3).

## CAPA gap
CAPA QMS-31 (replace worn upper punches, add punch-length check) closed 12 Mar 2026. QMS-30 and QMS-41 happened after it closed, so the fix likely did not hold.

## Hypotheses to test
- Punch-length check in SOP-012 is not done at the frequency the CAPA intended.
- Replacement punches came from the same supplier lot and wear at the same rate.
- Feed frame speed setting drifts after changeover.

## Suggested next steps
- Pull punch-length records for Press 4 since 12 Mar 2026.
- Review SOP-012 revision (2 Nov 2025) against the CAPA action.
- Ask Ravi Patel to join the investigation.

Drafted by Recurrence Radar. Decision support only: verify before use.`;

const PROJECTS = [
  { id: '10000', key: 'QMS', name: 'Quality Events' },
  { id: '10001', key: 'MFG', name: 'Manufacturing Ops' },
  { id: '10002', key: 'LAB', name: 'QC Lab' },
];

let settings = {
  watchedProjectKeys: ['QMS'],
  deviationLabel: '',
  capaLabel: 'capa',
  sopLabel: 'sop',
  llmEnabled: true,
  llmDailyCap: 200,
  matchThreshold: 0.45,
};
// Demo loader runs in the background on the real backend; the mock walks
// through the same steps on a timer so polling can be seen in dev.
const STEPS = ['Creating issues', 'Saving history', 'Linking CAPAs', 'Closing finished records', 'Scoring deviations'];
let demo =
  STATE === 'loaded'
    ? { state: 'done', loaded: true, projectKey: 'QMS', projectId: '10000', counts: { SOP: 6, DEV: 40, CAPA: 8 } }
    : STATE === 'running'
      ? {
          state: 'running',
          loaded: false,
          step: 'Saving history',
          projectKey: 'QMS',
          startedAt: new Date(Date.now() - 23000).toISOString(),
        }
      : { state: 'none', loaded: false };
let demoJob = null;

function demoNow() {
  if (demoJob) {
    const elapsed = Date.now() - demoJob.started;
    if (demoJob.kind === 'seed') {
      const idx = Math.floor(elapsed / 3000);
      if (idx >= STEPS.length) {
        demo = {
          state: 'done',
          loaded: true,
          projectKey: demoJob.projectKey,
          projectId: '10003',
          counts: { SOP: 6, DEV: 40, CAPA: 8 },
        };
        demoJob = null;
      } else {
        demo = {
          state: 'running',
          loaded: false,
          step: STEPS[idx],
          projectKey: demoJob.projectKey,
          startedAt: new Date(demoJob.started).toISOString(),
        };
      }
    } else if (elapsed > 4000) {
      demo = { state: 'none', loaded: false };
      demoJob = null;
    } else {
      demo = { ...demo, state: 'removing', startedAt: new Date(demoJob.started).toISOString() };
    }
  }
  return demo;
}

const MONTHS = [
  '2025-06',
  '2025-07',
  '2025-08',
  '2025-09',
  '2025-10',
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
];
const MONTH_COUNTS = [1, 2, 1, 3, 2, 2, 1, 3, 4, 2, 1, 3, 4, 2, 3, 5, 3];

const OVERVIEW = {
  totals: { deviations: 42, high: 6, medium: 11, ineffectiveCapas: 2 },
  openHigh: [
    {
      issueKey: 'QMS-48',
      summary: 'Tablet weight out of spec on Press 4 during compression, batch B2291',
      level: 'HIGH',
      headline: 'QMS-31 closed 12 Mar 2026. 2 recurrences since. Likely ineffective.',
      eventDate: '2026-10-30',
    },
    {
      issueKey: 'QMS-46',
      summary: 'Granulator torque alarm during wet massing, line 2',
      level: 'HIGH',
      headline: 'Seen 4 times in 12 months on Granulator G2.',
      eventDate: '2026-10-21',
    },
    {
      issueKey: 'QMS-43',
      summary: 'Blister seal integrity failure on BL-1, leak test',
      level: 'HIGH',
      headline: 'QMS-27 closed 2 May 2026. 1 recurrence since.',
      eventDate: '2026-10-02',
    },
    {
      issueKey: 'QMS-39',
      summary: 'Coating pan spray gun clog, uneven film coat',
      level: 'HIGH',
      headline: 'Seen 3 times in 9 months.',
      eventDate: '2026-09-11',
    },
  ],
  ineffectiveCapas: [
    {
      issueKey: 'QMS-31',
      summary: 'Replace worn upper punches on Press 4 and add punch-length check',
      closedDate: '2026-03-12',
      recurrencesSince: 2,
      sinceKeys: ['QMS-30', 'QMS-41'],
    },
    {
      issueKey: 'QMS-27',
      summary: 'Adjust seal temperature window on BL-1',
      closedDate: '2026-05-02',
      recurrencesSince: 1,
      sinceKeys: ['QMS-43'],
    },
  ],
  topEquipment: [
    { name: 'Press 4', count: 9 },
    { name: 'Granulator G2', count: 7 },
    { name: 'Blister line BL-1', count: 6 },
    { name: 'Coating pan C1', count: 4 },
    { name: 'Fluid bed dryer FBD-2', count: 3 },
  ],
  topFailureModes: [
    { name: 'Weight variation', count: 10 },
    { name: 'Seal failure', count: 6 },
    { name: 'Torque alarm', count: 5 },
    { name: 'Contamination', count: 4 },
    { name: 'Moisture out of range', count: 3 },
  ],
  timeline: MONTHS.map((month, i) => ({ month, count: MONTH_COUNTS[i] })),
};

const EMPTY_OVERVIEW = {
  totals: { deviations: 0, high: 0, medium: 0, ineffectiveCapas: 0 },
  openHigh: [],
  ineffectiveCapas: [],
  topEquipment: [],
  topFailureModes: [],
  timeline: [],
};

const llm = { available: true, enabled: true };

export async function mockInvoke(name, payload = {}) {
  switch (name) {
    case 'getAnalysis': {
      await wait(500);
      if (STATE === 'not_tracked') return { status: 'not_tracked', reason: 'project', llm };
      if (STATE === 'capa') return { status: 'not_tracked', reason: 'CAPA', llm };
      if (STATE === 'recheck') {
        pendingCalls += 1;
        if (pendingCalls < 3) return { status: 'pending', analysis: variant('ready'), llm };
      }
      if (STATE === 'error') return { status: 'error', message: 'Could not read issue history.', llm };
      if (STATE === 'pending') {
        pendingCalls += 1;
        if (pendingCalls < 3) return { status: 'pending', llm };
      }
      return {
        status: 'ready',
        analysis: { ...variant(STATE), computedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
        llm,
      };
    }
    case 'runAnalysis':
      await wait(400);
      pendingCalls = 0;
      return { status: 'pending', analysis: STATE === 'pending' ? undefined : variant(STATE), llm };
    case 'draftInvestigation':
      await wait(2500);
      return { text: DRAFT, method: 'llm' };
    case 'postDraft':
      await wait(700);
      return { ok: true, commentId: '20001' };
    case 'getSetup':
      await wait(400);
      return {
        projects: PROJECTS,
        settings,
        demo: demoNow(),
        llm: { available: true, callsToday: 14, cap: settings.llmDailyCap, model: 'claude-haiku' },
        isAdmin: true,
      };
    case 'seedDemo': {
      await wait(500);
      if (demoNow().state !== 'none')
        return { ok: false, status: demo.state, message: 'Demo data is already loaded or loading.' };
      const projectKey = payload.createProject ? 'RRDEMO' : payload.projectKey;
      demoJob = { kind: 'seed', started: Date.now(), projectKey };
      demoNow();
      return { ok: true, status: 'running', projectKey };
    }
    case 'removeDemo':
      await wait(500);
      demoJob = { kind: 'remove', started: Date.now() };
      demoNow();
      return { ok: true, status: 'removing' };
    case 'saveSettings':
      await wait(500);
      settings = { ...settings, ...payload };
      return { ok: true, settings };
    case 'getOverview':
      await wait(500);
      if (STATE === 'unwatched') return { ...EMPTY_OVERVIEW, watched: false, projectKey: 'MFG' };
      return STATE === 'empty'
        ? { ...EMPTY_OVERVIEW, watched: true, projectKey: 'QMS' }
        : { ...OVERVIEW, watched: true, projectKey: 'QMS' };
    default:
      throw new Error(`Mock has no resolver "${name}"`);
  }
}

export const mockContext = {
  extension: { issue: { key: 'QMS-48', id: '10148' }, project: { key: 'QMS', id: '10000' } },
};
