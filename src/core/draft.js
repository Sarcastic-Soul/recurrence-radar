// Investigation draft: an LLM prompt, a no-LLM template, and a converter from
// the plain-text draft to Atlassian Document Format (ADF) for a Jira comment.
import { formatDate } from './dates.js';

const SECTIONS = [
  'Problem statement',
  'Prior similar events',
  'What earlier investigations found',
  'Hypotheses to test',
  'CAPA effectiveness gap',
  'Suggested next steps',
  'Who to involve',
];

const trim = (s, n) => {
  const t = String(s || '').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

const byIdMap = (events) => new Map((events || []).map((e) => [String(e.issueId), e]));

// Plain-text data block shared by the prompt.
function dataBlock(target, analysis, events) {
  const byId = byIdMap(events);
  const lines = [];
  lines.push(`Current deviation: [${target.issueKey}] ${target.summary || ''}`);
  lines.push(`Date: ${target.eventDate || 'unknown'}`);
  const ex = analysis.extracted || {};
  lines.push(
    `Extracted: equipment=${ex.equipment ?? 'unknown'}; product=${ex.product ?? 'unknown'}; failure mode=${ex.failureMode ?? 'unknown'}`,
  );
  if (target.description) lines.push(`Description: ${trim(target.description, 1500)}`);
  lines.push('');
  lines.push(`Recurrence level: ${analysis.level}. ${analysis.headline || ''}`);
  lines.push('Past similar deviations:');
  if (!analysis.matches?.length) lines.push('- none found');
  for (const m of analysis.matches || []) {
    const ev = byId.get(String(m.issueId));
    lines.push(
      `- [${m.issueKey}] ${m.eventDate} "${m.summary}" sim=${m.sim}; root cause=${m.rootCause ?? 'not recorded'}; resolved by ${m.resolverName ?? 'unknown'}; status ${m.status}${ev?.sopRef ? `; SOP ${ev.sopRef}` : ''}`,
    );
  }
  const c = analysis.capa || {};
  lines.push('');
  if (c.status && c.status !== 'none') {
    lines.push(
      `Linked CAPA: [${c.issueKey}] "${c.summary}" status=${c.status}; closed=${c.closedDate ?? 'still open'}; owner=${c.ownerName ?? 'unknown'}; recurrences since close=${c.recurrencesSince} (${(c.sinceKeys || []).map((k) => `[${k}]`).join(', ') || 'none'})`,
    );
  } else lines.push('Linked CAPA: none on record.');
  const s = analysis.sop;
  lines.push(s ? `SOP: ${s.sopRef} "${s.title ?? ''}" last revised ${s.lastRevised ?? 'unknown'} (tied to ${s.count} past events)` : 'SOP: none identified.');
  lines.push(
    `People with experience: ${
      (analysis.experts || []).map((e) => `${e.name} (resolved ${e.resolved} of ${e.of}${e.capaOwned ? ', owned the CAPA' : ''})`).join('; ') || 'none identified'
    }`,
  );
  return lines.join('\n');
}

// Prompt for the LLM investigation draft.
export function buildDraftPrompt(target, analysis, events) {
  const system = [
    'You are a senior QA investigator in regulated pharma / medtech manufacturing.',
    'Write a concise first draft of a deviation investigation from the data the user gives you.',
    'Rules:',
    '- Cite every past ticket by its key in square brackets, like [QMS-12].',
    '- Use only facts in the data. Do not invent dates, people, root causes, test results or ticket keys. If something is unknown, say so.',
    '- This is decision support for a human investigator. Use wording like "suggests", "worth checking". Make no compliance, GxP or regulatory claims.',
    '- Plain text only. Start each section with a line "## <Section name>". Use "- " for bullets. No markdown tables, no bold.',
    `- Use exactly these sections in order: ${SECTIONS.join('; ')}.`,
    '- "Prior similar events" is a bulleted list with key, date and root cause. "Hypotheses to test" has 3 to 5 bullets.',
    '- Keep the whole draft under 450 words.',
  ].join('\n');
  const user = `${dataBlock(target, analysis, events)}\n\nWrite the investigation draft now.`;
  return { system, user };
}

// Generic hypotheses by failure mode, used when earlier root causes are thin.
const FAILURE_HINTS = {
  'Weight variation': ['Punch or die wear changing fill depth', 'Feeder or hopper level changes during the run', 'Granule flow or particle size shift in the blend'],
  'Seal integrity failure': ['Seal jaw temperature or dwell time drifting', 'Change in foil or film lot', 'Worn or dirty sealing tooling'],
  'Particulate contamination': ['Shedding from gaskets, filters or tubing', 'Gaps in line clearance or cleaning', 'Incoming component contamination'],
  'Out-of-spec assay': ['Sample preparation or standard error in the lab', 'Blend uniformity problem upstream', 'Raw material potency change'],
  'Temperature excursion': ['Probe or controller calibration drift', 'Door-open or loading pattern changes', 'HVAC or refrigeration unit performance'],
  'Label mix-up': ['Line clearance step missed between batches', 'Label roll storage and issue control', 'Vision system setup or bypass'],
  'Hardness out of spec': ['Compression force settings drifting', 'Blend moisture change', 'Tooling wear'],
  'Dissolution failure': ['Over-compression or coating thickness change', 'Excipient lot change', 'Granulation end-point variation'],
  'Fill volume deviation': ['Pump or nozzle wear', 'Fill weight check frequency too low', 'Product viscosity or temperature change'],
  'Documentation error': ['Batch record layout causing missed entries', 'Workload at shift change', 'Training on the current record version'],
  'Environmental monitoring excursion': ['Gowning or aseptic behaviour during interventions', 'Air handling or pressure differential change', 'Cleaning and disinfection rotation'],
  'Capping defect': ['Capping head torque setting drift', 'Cap or bottle dimension change from supplier', 'Worn chuck or capping inserts'],
};
const GENERIC_HINTS = ['Calibration of the measuring or control equipment', 'Change in incoming material lot', 'Procedure or training gap at the step where it failed'];

// Deterministic draft built straight from the analysis (no LLM).
export function templateDraft(target, analysis, events) {
  const matches = analysis.matches || [];
  const capa = analysis.capa || { status: 'none' };
  const ex = analysis.extracted || {};
  const keys = (list) => list.map((m) => `[${m.issueKey}]`).join(', ');
  const out = [];

  out.push('## Problem statement');
  const where = [ex.failureMode, ex.equipment && `on ${ex.equipment}`, ex.product && `for ${ex.product}`].filter(Boolean).join(' ');
  out.push(
    `[${target.issueKey}] ${target.summary || ''} (${formatDate(target.eventDate) || 'date unknown'}).${where ? ` Recorded as ${where}.` : ''} Recurrence level: ${analysis.level}. ${analysis.headline || ''}`.trim(),
  );
  out.push('');

  out.push('## Prior similar events');
  if (!matches.length) out.push('- No similar past events found.');
  for (const m of matches) {
    out.push(`- [${m.issueKey}] ${formatDate(m.eventDate)}: ${m.summary}. Root cause: ${m.rootCause ?? 'not recorded'}.`);
  }
  out.push('');

  out.push('## What earlier investigations found');
  const causes = new Map();
  for (const m of matches) if (m.rootCause) causes.set(m.rootCause, [...(causes.get(m.rootCause) || []), m]);
  if (!causes.size) out.push('No root cause was recorded on the earlier events.');
  for (const [cause, list] of causes) out.push(`- ${cause}: ${keys(list)}`);
  out.push('');

  out.push('## Hypotheses to test');
  const hyps = [];
  for (const [cause, list] of causes) hyps.push(`${cause} again, as found in ${keys(list)}. Check whether the earlier fix still holds.`);
  for (const h of [...(FAILURE_HINTS[ex.failureMode] || []), ...GENERIC_HINTS]) {
    if (hyps.length >= 5) break;
    if (!hyps.some((x) => x.toLowerCase().startsWith(h.toLowerCase().slice(0, 12)))) hyps.push(h);
  }
  for (const h of hyps.slice(0, 5)) out.push(`- ${h}`);
  out.push('');

  out.push('## CAPA effectiveness gap');
  if (capa.status === 'likely_ineffective') {
    out.push(
      `CAPA [${capa.issueKey}] closed ${formatDate(capa.closedDate)}, and ${capa.recurrencesSince} similar ${capa.recurrencesSince === 1 ? 'event has' : 'events have'} happened since: ${capa.sinceKeys.map((k) => `[${k}]`).join(', ')}. This suggests the CAPA did not remove the cause.`,
    );
  } else if (capa.status === 'effective') {
    out.push(`CAPA [${capa.issueKey}] closed ${formatDate(capa.closedDate)} with no similar events since. It appears to have held.`);
  } else if (capa.status === 'open') {
    out.push(`CAPA [${capa.issueKey}] is still open. Check whether this event falls under its scope.`);
  } else {
    out.push(matches.length ? 'No CAPA is linked to the earlier events.' : 'Not applicable: no earlier events.');
  }
  out.push('');

  out.push('## Suggested next steps');
  if (capa.status === 'likely_ineffective') out.push(`- Reopen or review CAPA [${capa.issueKey}] for effectiveness.`);
  if (capa.status === 'none' && matches.length >= 2) out.push('- Consider raising a CAPA for this recurring problem.');
  if (analysis.sop) {
    out.push(`- Review ${analysis.sop.sopRef}${analysis.sop.title ? ` (${analysis.sop.title})` : ''}, last revised ${formatDate(analysis.sop.lastRevised) || 'unknown'}.`);
  }
  out.push('- Test the hypotheses above against batch data and equipment logs.');
  out.push('- Assess product impact for the affected batch before disposition.');
  out.push('');

  out.push('## Who to involve');
  if (!analysis.experts?.length) out.push('- No one with prior experience identified.');
  for (const e of analysis.experts || []) {
    const roles = [];
    if (e.resolved) roles.push(`resolved ${e.resolved} of ${e.of} similar events`);
    if (e.capaOwned) roles.push('owned the linked CAPA');
    if (!roles.length) roles.push('reported an earlier similar event');
    out.push(`- ${e.name}: ${roles.join(', ')}.`);
  }
  return out.join('\n');
}

// ADF helpers.
const textNode = (t) => ({ type: 'text', text: t });
const para = (lines) => {
  const content = [];
  lines.forEach((l, i) => {
    if (i > 0) content.push({ type: 'hardBreak' });
    content.push(textNode(l));
  });
  return { type: 'paragraph', content };
};
const listItem = (t) => ({ type: 'listItem', content: [para([t])] });

// Converts the plain-text draft to an ADF doc:
// "## x" (or "#"/"###") -> heading level 3; "- x" / "* x" -> bullet list;
// "1. x" -> ordered list; blank lines split paragraphs.
export function toAdf(text) {
  const content = [];
  let paraLines = [];
  let list = null; // { type: 'bulletList'|'orderedList', items: [] }

  const flushPara = () => {
    if (paraLines.length) content.push(para(paraLines));
    paraLines = [];
  };
  const flushList = () => {
    if (list) content.push({ type: list.type, content: list.items.map(listItem) });
    list = null;
  };

  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    let m;
    if (!line) {
      flushPara();
      flushList();
    } else if ((m = /^#{1,6}\s+(.*)$/.exec(line))) {
      flushPara();
      flushList();
      if (m[1].trim()) content.push({ type: 'heading', attrs: { level: 3 }, content: [textNode(m[1].trim())] });
    } else if ((m = /^[-*•]\s+(.*)$/.exec(line)) || (m = /^\d+[.)]\s+(.*)$/.exec(line))) {
      const type = /^\d/.test(line) ? 'orderedList' : 'bulletList';
      flushPara();
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      if (m[1].trim()) list.items.push(m[1].trim());
    } else {
      flushList();
      paraLines.push(line);
    }
  }
  flushPara();
  flushList();
  // ADF needs at least one block; an empty list would be invalid.
  const blocks = content.filter((b) => !(b.content && b.content.length === 0));
  return { type: 'doc', version: 1, content: blocks.length ? blocks : [{ type: 'paragraph', content: [] }] };
}
