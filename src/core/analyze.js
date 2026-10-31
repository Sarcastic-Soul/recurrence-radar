// Runs the full recurrence analysis for one deviation and returns the
// contract's Analysis object. `target` must already have extracted fields.
import { findMatches, computeStats, computeLevel, DEFAULT_THRESHOLD } from './score.js';
import { assessCapa } from './capa.js';
import { rankExperts } from './expert.js';
import { pickSop } from './sop.js';
import { buildHeadline } from './headline.js';

export function analyze(target, events, links, { now = new Date(), threshold = DEFAULT_THRESHOLD, method = 'rules' } = {}) {
  const matches = findMatches(target, events, { threshold, now });
  const stats = computeStats(matches, target);
  const capa = assessCapa(target, matches, events, links);
  const level = computeLevel(matches, stats, capa);

  const analysis = {
    issueId: target.issueId,
    issueKey: target.issueKey,
    level,
    score: matches[0]?.sim ?? 0,
    method,
    computedAt: new Date(now).toISOString(),
    extracted: {
      equipment: target.equipment ?? null,
      product: target.product ?? null,
      failureMode: target.failureMode ?? null,
      rootCause: target.rootCause ?? null,
      keywords: target.keywords ?? [],
    },
    headline: '',
    matches,
    stats,
    capa,
    experts: rankExperts(matches, capa, events),
    sop: pickSop(matches, events),
  };
  analysis.headline = buildHeadline(analysis);
  return analysis;
}
