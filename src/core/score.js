// Similarity scoring, match finding, stats and recurrence level (BLUEPRINT §5).
import { daysBetween, isoDate } from './dates.js';

// All weights in one place so they're easy to tune.
export const WEIGHTS = {
  equipment: 0.35,
  failureMode: 0.3,
  product: 0.15,
  keywords: 0.15,
  recency: 0.05,
  rootCauseBonus: 0.05,
};
export const RECENCY_FULL_DAYS = 90; // full recency credit inside this window
export const RECENCY_ZERO_DAYS = 730; // no credit past this
export const DEFAULT_THRESHOLD = 0.45;

// Case-insensitive equality; both sides must be non-empty.
function same(a, b) {
  return a != null && b != null && a !== '' && String(a).toLowerCase() === String(b).toLowerCase();
}

// Jaccard overlap of two keyword lists. Returns { score, shared }.
export function jaccard(a = [], b = []) {
  const A = new Set(a.map((x) => String(x).toLowerCase()));
  const B = new Set(b.map((x) => String(x).toLowerCase()));
  if (!A.size || !B.size) return { score: 0, shared: [] };
  const shared = [...A].filter((x) => B.has(x));
  const union = new Set([...A, ...B]).size;
  return { score: shared.length / union, shared };
}

// 1 within 90 days, linear fade to 0 at 730 days.
export function recency(days) {
  const d = Math.abs(days);
  if (Number.isNaN(d)) return 0;
  if (d <= RECENCY_FULL_DAYS) return 1;
  if (d >= RECENCY_ZERO_DAYS) return 0;
  return 1 - (d - RECENCY_FULL_DAYS) / (RECENCY_ZERO_DAYS - RECENCY_FULL_DAYS);
}

// Scores how alike `candidate` is to `target`. Returns { sim, reasons }.
// `now` is only used when the target has no eventDate.
export function similarity(target, candidate, now = new Date()) {
  const reasons = [];
  let sim = 0;

  for (const type of ['equipment', 'failureMode', 'product']) {
    if (same(target[type], candidate[type])) {
      sim += WEIGHTS[type];
      reasons.push({ type, label: candidate[type] });
    }
  }

  const kw = jaccard(target.keywords, candidate.keywords);
  sim += WEIGHTS.keywords * kw.score;
  if (kw.shared.length) {
    const n = kw.shared.length;
    reasons.push({
      type: 'keywords',
      label: `${n} shared term${n === 1 ? '' : 's'}: ${kw.shared.slice(0, 3).join(', ')}`,
    });
  }

  const ref = target.eventDate || isoDate(now);
  sim += WEIGHTS.recency * recency(daysBetween(candidate.eventDate, ref));

  if (same(target.rootCause, candidate.rootCause)) {
    sim += WEIGHTS.rootCauseBonus;
    reasons.push({ type: 'rootCause', label: candidate.rootCause });
  }

  return { sim: Math.min(1, sim), reasons };
}

// Finds past deviations similar to `target`. Candidates: DEV events, not the
// target itself, dated on or before the target. Sorted by sim desc, max `max`.
export function findMatches(target, events, { threshold = DEFAULT_THRESHOLD, now = new Date(), max = 8 } = {}) {
  const ref = target.eventDate || isoDate(now);
  const out = [];
  for (const ev of events || []) {
    if (ev.kind !== 'DEV' || String(ev.issueId) === String(target.issueId)) continue;
    if (!ev.eventDate || ev.eventDate > ref) continue; // ISO strings compare correctly
    const { sim, reasons } = similarity(target, ev, now);
    if (sim < threshold) continue;
    out.push({
      issueId: ev.issueId,
      issueKey: ev.issueKey,
      summary: ev.summary,
      eventDate: ev.eventDate,
      status: ev.status,
      sim: Math.round(sim * 100) / 100,
      reasons,
      rootCause: ev.rootCause ?? null,
      resolverName: ev.resolverName ?? null,
    });
  }
  // Highest sim first; newer events win ties.
  out.sort((a, b) => b.sim - a.sim || (a.eventDate < b.eventDate ? 1 : -1));
  return out.slice(0, max);
}

// Summary numbers for the panel. windowMonths is 0 when there are no matches.
export function computeStats(matches, target) {
  const ref = target.eventDate;
  const dates = matches.map((m) => m.eventDate).filter(Boolean).sort();
  const last12Months = matches.filter((m) => {
    const d = daysBetween(m.eventDate, ref);
    return d >= 0 && d <= 365;
  }).length;
  const firstDate = dates[0] ?? null;
  const lastDate = dates[dates.length - 1] ?? null;
  const windowMonths = firstDate ? Math.max(1, Math.ceil(daysBetween(firstDate, ref) / 30.44)) : 0;
  return { matchCount: matches.length, last12Months, windowMonths, firstDate, lastDate };
}

// HIGH / MEDIUM / LOW / NONE per BLUEPRINT §5.
export function computeLevel(matches, stats, capa) {
  if (stats.last12Months >= 2 || capa?.status === 'likely_ineffective') return 'HIGH';
  if (stats.last12Months === 1 || stats.matchCount >= 2) return 'MEDIUM';
  if (stats.matchCount === 1) return 'LOW';
  return 'NONE';
}
