/**
 * Project-level summary for the Recurrence Radar project page.
 */
import { getAnalysesForProject, getEventsForProjects } from '../db/queries';

export async function buildOverview(projectId) {
  const [analyses, events] = await Promise.all([
    getAnalysesForProject(projectId),
    getEventsForProjects([String(projectId)]),
  ]);
  const devs = events.filter((e) => e.kind === 'DEV');
  const byId = new Map(events.map((e) => [e.issueId, e]));

  const openHigh = analyses
    .filter((a) => a.level === 'HIGH' && byId.get(String(a.issueId))?.status === 'open')
    .map((a) => ({
      issueKey: a.issueKey,
      summary: byId.get(String(a.issueId))?.summary || '',
      level: a.level,
      headline: a.headline,
      eventDate: byId.get(String(a.issueId))?.eventDate || null,
    }))
    .sort((x, y) => String(y.eventDate).localeCompare(String(x.eventDate)));

  // A CAPA counts as "likely ineffective" if any analysis says so; keep the worst count.
  const capaMap = new Map();
  for (const a of analyses) {
    const c = a.capa;
    if (c && c.status === 'likely_ineffective' && c.issueKey) {
      const prev = capaMap.get(c.issueKey);
      if (!prev || c.recurrencesSince > prev.recurrencesSince) {
        capaMap.set(c.issueKey, {
          issueKey: c.issueKey,
          summary: c.summary,
          closedDate: c.closedDate,
          recurrencesSince: c.recurrencesSince,
          sinceKeys: c.sinceKeys || [],
        });
      }
    }
  }

  const count = (key) => {
    const m = new Map();
    for (const e of devs) if (e[key]) m.set(e[key], (m.get(e[key]) || 0) + 1);
    return [...m.entries()].map(([name, n]) => ({ name, count: n })).sort((a, b) => b.count - a.count).slice(0, 6);
  };

  // Deviations per month for the last 18 months.
  const months = [];
  const now = new Date();
  for (let i = 17; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const perMonth = new Map(months.map((m) => [m, 0]));
  for (const e of devs) {
    const m = String(e.eventDate).slice(0, 7);
    if (perMonth.has(m)) perMonth.set(m, perMonth.get(m) + 1);
  }

  return {
    totals: {
      deviations: devs.length,
      high: analyses.filter((a) => a.level === 'HIGH').length,
      medium: analyses.filter((a) => a.level === 'MEDIUM').length,
      ineffectiveCapas: capaMap.size,
    },
    openHigh: openHigh.slice(0, 20),
    ineffectiveCapas: [...capaMap.values()],
    topEquipment: count('equipment'),
    topFailureModes: count('failureMode'),
    timeline: months.map((m) => ({ month: m, count: perMonth.get(m) })),
  };
}
