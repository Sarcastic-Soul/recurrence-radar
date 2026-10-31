// CAPA effectiveness: was the fix raised for earlier matches followed by more
// matching events after it closed?

const NO_CAPA = {
  status: 'none',
  issueKey: null,
  issueId: null,
  summary: null,
  closedDate: null,
  ownerName: null,
  recurrencesSince: 0,
  sinceKeys: [],
};

// Returns the contract's capa object for `target`.
// links: [{ capaIssueId, devIssueId }]
export function assessCapa(target, matches, events, links) {
  const matchedIds = new Set(matches.map((m) => String(m.issueId)));
  const capaIds = new Set(
    (links || []).filter((l) => matchedIds.has(String(l.devIssueId))).map((l) => String(l.capaIssueId)),
  );
  const candidates = (events || []).filter((e) => e.kind === 'CAPA' && capaIds.has(String(e.issueId)));
  if (!candidates.length) return { ...NO_CAPA, sinceKeys: [] };

  // An open CAPA is the current action, so it wins. Otherwise take the one
  // that closed most recently.
  const open = candidates.filter((c) => c.status !== 'closed' || !c.closedDate);
  const pool = open.length ? open : candidates;
  const key = (c) => (open.length ? c.eventDate : c.closedDate) || '';
  const chosen = [...pool].sort((a, b) => (key(a) < key(b) ? 1 : -1))[0];

  const base = {
    issueKey: chosen.issueKey,
    issueId: chosen.issueId,
    summary: chosen.summary,
    closedDate: chosen.closedDate ?? null,
    ownerName: chosen.ownerName ?? null,
  };
  if (open.length) return { status: 'open', ...base, recurrencesSince: 0, sinceKeys: [] };

  // Recurrences = matched deviations plus the target dated after the close.
  const later = [...matches, target]
    .filter((e) => e.eventDate && e.eventDate > chosen.closedDate)
    .sort((a, b) => (a.eventDate < b.eventDate ? -1 : 1));
  if (!later.length) return { status: 'effective', ...base, recurrencesSince: 0, sinceKeys: [] };
  return {
    status: 'likely_ineffective',
    ...base,
    recurrencesSince: later.length,
    sinceKeys: later.map((e) => e.issueKey),
  };
}
