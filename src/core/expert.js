// Expert finder: who has dealt with this kind of problem before?
// Points: resolver of a matched deviation = 2, owner of the linked CAPA = 2,
// reporter (owner) of a matched deviation = 1.

export function rankExperts(matches, capa, events) {
  const byId = new Map((events || []).map((e) => [String(e.issueId), e]));
  const people = new Map();
  const get = (name) => {
    if (!people.has(name)) people.set(name, { name, points: 0, resolved: 0, capaOwned: 0, of: matches.length });
    return people.get(name);
  };

  for (const m of matches) {
    const resolver = m.resolverName ?? byId.get(String(m.issueId))?.resolverName;
    if (resolver) {
      const p = get(resolver);
      p.points += 2;
      p.resolved += 1;
    }
    const owner = byId.get(String(m.issueId))?.ownerName;
    if (owner) get(owner).points += 1;
  }
  if (capa?.ownerName && capa.status !== 'none') {
    const p = get(capa.ownerName);
    p.points += 2;
    p.capaOwned += 1;
  }

  // Most points first; ties by resolved count, then name.
  return [...people.values()]
    .sort((a, b) => b.points - a.points || b.resolved - a.resolved || a.name.localeCompare(b.name))
    .slice(0, 3);
}
