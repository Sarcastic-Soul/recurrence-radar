import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractRules,
  buildExtractionPrompt,
  parseExtraction,
  textHash,
  stem,
  similarity,
  findMatches,
  computeStats,
  computeLevel,
  assessCapa,
  rankExperts,
  pickSop,
  buildHeadline,
  analyze,
  buildDraftPrompt,
  templateDraft,
  toAdf,
  formatDate,
} from '../src/core/index.js';
import { events, links, byKey, NOW } from './fixture.js';

const press = byKey('QMS-9');
const seal = byKey('QMS-6');

test('extractRules finds equipment and failure mode, drops batch numbers', () => {
  const r = extractRules('Tablet weight out of spec on Press 4 during compression, batch B2291');
  assert.equal(r.equipment, 'Press 4');
  assert.equal(r.failureMode, 'Weight variation');
  assert.equal(r.product, null);
  assert.ok(r.keywords.includes('weight'));
  assert.ok(r.keywords.includes('compression'));
  assert.ok(!r.keywords.some((k) => /\d/.test(k)));
  assert.ok(!r.keywords.includes('on') && !r.keywords.includes('batch'));
  assert.ok(r.keywords.length <= 12);
});

test('extractRules handles synonyms and other categories', () => {
  const r = extractRules('Leak test failure on blister line 1 for ibuprofen. Root cause: sensor drift (out of calibration).');
  assert.equal(r.equipment, 'Blister B1');
  assert.equal(r.product, 'Ibuprofen 200 mg tablets');
  assert.equal(r.failureMode, 'Seal integrity failure');
  assert.equal(r.rootCause, 'Calibration drift');
  assert.equal(extractRules('tablet press #4 underweight').equipment, 'Press 4');
  assert.equal(extractRules('Nothing relevant here').equipment, null);
});

test('stem strips plurals and verb endings', () => {
  assert.equal(stem('punches'), 'punch');
  assert.equal(stem('sealing'), 'seal');
  assert.equal(stem('drifted'), 'drift');
  assert.equal(stem('tablets'), 'tablet');
  assert.equal(stem('process'), 'process');
});

test('buildExtractionPrompt includes vocabulary and text', () => {
  const p = buildExtractionPrompt('Seal leak on Line 2');
  assert.match(p.system, /Press 4/);
  assert.match(p.system, /Weight variation/);
  assert.match(p.system, /ONLY a JSON/);
  assert.match(p.user, /Seal leak on Line 2/);
});

test('parseExtraction handles fenced JSON and maps synonyms', () => {
  const llm = '```json\n{"equipment":"tablet press 4","product":"metformin","failureMode":"weight drift","rootCause":null,"keywords":["Punch","weights"]}\n```';
  const r = parseExtraction(llm, 'Tablet weight out of spec on Press 4');
  assert.equal(r.equipment, 'Press 4');
  assert.equal(r.product, 'Metformin 500 mg tablets');
  assert.equal(r.failureMode, 'Weight variation');
  assert.equal(r.rootCause, null);
  assert.ok(r.keywords.includes('punch'));
  assert.ok(r.keywords.includes('weight'));
});

test('parseExtraction falls back to rules on garbage and keeps short unknowns', () => {
  const text = 'Tablet weight out of spec on Press 4';
  assert.deepEqual(parseExtraction('sorry, I cannot help', text), extractRules(text));
  assert.deepEqual(parseExtraction('{not json at all}', text), extractRules(text));
  assert.deepEqual(parseExtraction(null, text), extractRules(text));
  const r = parseExtraction('Here you go: {"equipment":"Centrifuge Z9","product":"x".repeat(1),"failureMode":null}', text);
  // invalid JSON above -> fallback
  assert.equal(r.equipment, 'Press 4');
  const r2 = parseExtraction('{"equipment":"Centrifuge Z9","failureMode":"WEIGHT VARIATION","rootCause":"' + 'x'.repeat(80) + '"}', text);
  assert.equal(r2.equipment, 'Centrifuge Z9');
  assert.equal(r2.failureMode, 'Weight variation');
  assert.equal(r2.rootCause, null);
});

test('textHash is deterministic hex', () => {
  assert.equal(textHash('abc'), textHash('abc'));
  assert.notEqual(textHash('abc'), textHash('abd'));
  assert.match(textHash('abc'), /^[0-9a-f]{16}$/);
  assert.equal(textHash(''), 'cbf29ce484222325');
});

test('similarity ranks same cluster above noise, with reasons', () => {
  const close = similarity(press, byKey('QMS-4'), NOW);
  const older = similarity(press, byKey('QMS-1'), NOW);
  const noise = similarity(press, byKey('QMS-11'), NOW);
  const far = similarity(press, byKey('QMS-3'), NOW);
  assert.ok(close.sim > noise.sim && noise.sim > far.sim);
  assert.ok(close.sim >= older.sim);
  const types = close.reasons.map((r) => r.type);
  assert.deepEqual(types.slice(0, 3), ['equipment', 'failureMode', 'product']);
  const kw = close.reasons.find((r) => r.type === 'keywords');
  assert.match(kw.label, /^\d+ shared terms?: /);
  assert.ok(kw.label.split(': ')[1].split(', ').length <= 3);
  assert.ok(close.sim <= 1);
});

test('similarity gives rootCause bonus and caps at 1', () => {
  const a = { ...press, rootCause: 'Tooling wear', keywords: ['x'] };
  const b = { ...a, issueId: 'z', eventDate: press.eventDate };
  const r = similarity(a, b, NOW);
  assert.equal(r.sim, 1);
  assert.ok(r.reasons.some((x) => x.type === 'rootCause' && x.label === 'Tooling wear'));
});

test('findMatches excludes self, future, non-DEV and weak matches', () => {
  const m = findMatches(press, events, { now: NOW });
  const keys = m.map((x) => x.issueKey);
  assert.deepEqual(keys.sort(), ['QMS-1', 'QMS-4']);
  assert.ok(!keys.includes('QMS-9')); // self
  assert.ok(!keys.includes('QMS-12')); // future
  assert.ok(!keys.includes('QMS-5')); // CAPA
  const first = findMatches(press, events, { now: NOW })[0];
  assert.deepEqual(Object.keys(first).sort(), ['eventDate', 'issueId', 'issueKey', 'reasons', 'resolverName', 'rootCause', 'sim', 'status', 'summary'].sort());
  assert.equal(first.issueKey, 'QMS-4');
  assert.equal(first.sim, Math.round(first.sim * 100) / 100);
  // same-day events are allowed
  const sameDay = { ...byKey('QMS-4'), issueId: 'same', issueKey: 'QMS-99', eventDate: press.eventDate };
  assert.ok(findMatches(press, [...events, sameDay], { now: NOW }).some((x) => x.issueKey === 'QMS-99'));
});

test('computeStats and computeLevel', () => {
  const m = findMatches(press, events, { now: NOW });
  const s = computeStats(m, press);
  assert.deepEqual(s, { matchCount: 2, last12Months: 1, windowMonths: 15, firstDate: '2025-06-12', lastDate: '2025-11-03' });
  assert.equal(computeLevel(m, s, { status: 'likely_ineffective' }), 'HIGH');
  assert.equal(computeLevel(m, s, { status: 'none' }), 'MEDIUM');
  assert.equal(computeLevel([], { matchCount: 0, last12Months: 0 }, { status: 'none' }), 'NONE');
  assert.equal(computeLevel([{}], { matchCount: 1, last12Months: 0 }, null), 'LOW');
  assert.equal(computeLevel([{}, {}], { matchCount: 2, last12Months: 2 }, null), 'HIGH');
  assert.equal(computeLevel([{}, {}], { matchCount: 2, last12Months: 0 }, null), 'MEDIUM');
});

test('assessCapa: Press 4 CAPA closed before the target is likely ineffective', () => {
  const m = findMatches(press, events, { now: NOW });
  const c = assessCapa(press, m, events, links);
  assert.equal(c.status, 'likely_ineffective');
  assert.equal(c.issueKey, 'QMS-5');
  assert.equal(c.closedDate, '2026-01-20');
  assert.equal(c.ownerName, 'Meera Shah');
  assert.equal(c.recurrencesSince, 1);
  assert.deepEqual(c.sinceKeys, ['QMS-9']);
});

test('assessCapa counts later matches too', () => {
  // Analysing the future QMS-12: QMS-9 and QMS-12 both came after the close.
  const t = byKey('QMS-12');
  const m = findMatches(t, events, { now: NOW });
  const c = assessCapa(t, m, events, links);
  assert.equal(c.status, 'likely_ineffective');
  assert.equal(c.recurrencesSince, 2);
  assert.deepEqual(c.sinceKeys, ['QMS-9', 'QMS-12']);
});

test('assessCapa: seal CAPA is effective, open CAPA, and none', () => {
  const m = findMatches(seal, events, { now: NOW });
  assert.deepEqual(m.map((x) => x.issueKey), ['QMS-2']);
  const c = assessCapa(seal, m, events, links);
  assert.equal(c.status, 'effective');
  assert.equal(c.issueKey, 'QMS-7');
  assert.equal(c.recurrencesSince, 0);
  assert.deepEqual(c.sinceKeys, []);

  const openEvents = events.map((e) => (e.issueKey === 'QMS-7' ? { ...e, status: 'open', closedDate: null } : e));
  assert.equal(assessCapa(seal, m, openEvents, links).status, 'open');

  const none = assessCapa(byKey('QMS-3'), [], events, links);
  assert.equal(none.status, 'none');
  assert.equal(none.issueKey, null);
  assert.deepEqual(none.sinceKeys, []);
});

test('rankExperts scores resolvers, CAPA owner and reporters', () => {
  const m = findMatches(press, events, { now: NOW });
  const c = assessCapa(press, m, events, links);
  const ex = rankExperts(m, c, events);
  assert.equal(ex.length, 3);
  assert.deepEqual(ex[0], { name: 'Ravi Patel', points: 4, resolved: 2, capaOwned: 0, of: 2 });
  assert.deepEqual(ex[1], { name: 'Meera Shah', points: 2, resolved: 0, capaOwned: 1, of: 2 });
  assert.equal(ex[2].name, 'Anna Kowalski'); // tie with Priya on 1 point, alphabetical
  assert.deepEqual(rankExperts([], { status: 'none' }, events), []);
});

test('pickSop returns the most common SOP with title and revision date', () => {
  const m = findMatches(press, events, { now: NOW });
  assert.deepEqual(pickSop(m, events), {
    sopRef: 'SOP-012',
    title: 'Tablet compression and in-process weight checks',
    lastRevised: '2025-11-02',
    count: 2,
    issueKey: 'QMS-13',
  });
  assert.equal(pickSop([], events), null);
});

test('buildHeadline covers the main cases', () => {
  assert.equal(formatDate('2026-03-12'), '12 Mar 2026');
  assert.equal(
    buildHeadline({ level: 'HIGH', stats: { matchCount: 2, last12Months: 1 }, capa: { status: 'likely_ineffective', issueKey: 'QMS-31', closedDate: '2026-03-12', recurrencesSince: 2 } }),
    'CAPA QMS-31 closed 12 Mar 2026 — 2 recurrences since. Likely ineffective.',
  );
  assert.equal(
    buildHeadline({ level: 'HIGH', stats: { matchCount: 3, last12Months: 3 }, capa: { status: 'none' } }),
    '3 similar events in the last 12 months. No CAPA on record.',
  );
  assert.equal(buildHeadline({ level: 'MEDIUM', stats: { matchCount: 1, last12Months: 1 }, capa: { status: 'none' } }), '1 similar event in the last 12 months.');
  assert.equal(buildHeadline({ level: 'NONE', stats: { matchCount: 0, last12Months: 0 }, capa: { status: 'none' } }), 'No similar past events found.');
});

test('analyze returns the full contract shape', () => {
  const a = analyze(press, events, links, { now: NOW });
  assert.deepEqual(Object.keys(a).sort(), ['capa', 'computedAt', 'experts', 'extracted', 'headline', 'issueId', 'issueKey', 'level', 'matches', 'method', 'score', 'sop', 'stats'].sort());
  assert.equal(a.level, 'HIGH');
  assert.equal(a.method, 'rules');
  assert.equal(a.computedAt, '2026-10-31T12:00:00.000Z');
  assert.equal(a.score, a.matches[0].sim);
  assert.equal(a.extracted.equipment, 'Press 4');
  assert.equal(a.headline, 'CAPA QMS-5 closed 20 Jan 2026 — 1 recurrence since. Likely ineffective.');

  const quiet = analyze(byKey('QMS-3'), events, links, { now: NOW, method: 'llm' });
  assert.equal(quiet.level, 'NONE');
  assert.equal(quiet.score, 0);
  assert.equal(quiet.sop, null);
  assert.equal(quiet.method, 'llm');
});

test('draft prompt and template cite keys', () => {
  const a = analyze(press, events, links, { now: NOW });
  const p = buildDraftPrompt({ ...press, description: 'x'.repeat(3000) }, a, events);
  assert.match(p.system, /\[QMS-12\]/);
  assert.match(p.system, /450 words/);
  assert.match(p.user, /\[QMS-4\]/);
  assert.ok(p.user.length < 3000 + 1500);

  const t = templateDraft(press, a, events);
  for (const key of ['[QMS-9]', '[QMS-1]', '[QMS-4]', '[QMS-5]']) assert.ok(t.includes(key), `missing ${key}`);
  for (const h of ['## Problem statement', '## Prior similar events', '## What earlier investigations found', '## Hypotheses to test', '## CAPA effectiveness gap', '## Suggested next steps', '## Who to involve']) {
    assert.ok(t.includes(h), `missing ${h}`);
  }
  const hyps = t.split('## Hypotheses to test\n')[1].split('\n\n')[0].split('\n');
  assert.ok(hyps.length >= 3 && hyps.length <= 5);
  // template for an event with no history still works
  assert.match(templateDraft(byKey('QMS-3'), analyze(byKey('QMS-3'), events, links, { now: NOW }), events), /No similar past events found/);
});

// Recursively checks ADF nodes: text nodes are non-empty strings, lists hold listItems.
function checkAdf(node) {
  assert.equal(typeof node.type, 'string');
  if (node.type === 'text') {
    assert.ok(typeof node.text === 'string' && node.text.length > 0);
    return;
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    assert.ok(node.content.length > 0);
    node.content.forEach((c) => assert.equal(c.type, 'listItem'));
  }
  (node.content || []).forEach(checkAdf);
}

test('toAdf builds a valid ADF doc', () => {
  const doc = toAdf('## Problem statement\nWeight issue on [QMS-12].\nSecond line.\n\n- one\n- two\nAfter list\n\n1. first\n2. second');
  assert.equal(doc.type, 'doc');
  assert.equal(doc.version, 1);
  checkAdf(doc);
  const types = doc.content.map((n) => n.type);
  assert.deepEqual(types, ['heading', 'paragraph', 'bulletList', 'paragraph', 'orderedList']);
  assert.deepEqual(doc.content[0].attrs, { level: 3 });
  assert.equal(doc.content[1].content[1].type, 'hardBreak');
  assert.equal(doc.content[2].content.length, 2);
  assert.equal(doc.content[2].content[0].content[0].content[0].text, 'one');

  const full = toAdf(templateDraft(press, analyze(press, events, links, { now: NOW }), events));
  checkAdf(full);
  assert.equal(full.content.filter((n) => n.type === 'heading').length, 7);
  assert.equal(toAdf('').content.length, 1);
});
