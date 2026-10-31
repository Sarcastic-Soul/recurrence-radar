// SOP link: the procedure most often tied to the matched deviations.

export function pickSop(matches, events) {
  const byId = new Map((events || []).map((e) => [String(e.issueId), e]));
  const counts = new Map();
  for (const m of matches) {
    const ref = byId.get(String(m.issueId))?.sopRef;
    if (ref) counts.set(ref, (counts.get(ref) || 0) + 1);
  }
  if (!counts.size) return null;

  // Highest count wins; ties go to the alphabetically first ref (stable output).
  const [sopRef, count] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const sopEvent = (events || []).find((e) => e.kind === 'SOP' && e.sopRef === sopRef);
  return {
    sopRef,
    title: sopEvent?.summary ?? null,
    lastRevised: sopEvent?.eventDate ?? null,
    count,
    issueKey: sopEvent?.issueKey ?? null,
  };
}
