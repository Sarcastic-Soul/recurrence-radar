// One plain-English sentence summing up an analysis.
import { formatDate } from './dates.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function buildHeadline(analysis) {
  const { level, stats = {}, capa } = analysis || {};
  if (!level || level === 'NONE' || !stats.matchCount) return 'No similar past events found.';

  if (capa?.status === 'likely_ineffective') {
    return `CAPA ${capa.issueKey} closed ${formatDate(capa.closedDate)} — ${plural(capa.recurrencesSince, 'recurrence')} since. Likely ineffective.`;
  }

  // Lead with the 12-month count when there is one, else the all-time count.
  let text =
    stats.last12Months > 0
      ? `${plural(stats.last12Months, 'similar event')} in the last 12 months.`
      : `${plural(stats.matchCount, 'similar past event')}, first on ${formatDate(stats.firstDate)}.`;

  if (capa?.status === 'open') text += ` CAPA ${capa.issueKey} is still open.`;
  else if (capa?.status === 'effective') text += ` CAPA ${capa.issueKey} has held since ${formatDate(capa.closedDate)}.`;
  else if (level === 'HIGH') text += ' No CAPA on record.';
  return text;
}
