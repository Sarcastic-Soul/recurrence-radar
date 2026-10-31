import {
  XCircle,
  CheckCircle,
  HourglassMedium,
  MinusCircle,
  FolderDashed,
  ClipboardText,
  BookOpen,
  WarningCircle,
  ArrowClockwise,
  CircleNotch,
} from '@phosphor-icons/react';
import {
  Button,
  EmptyState,
  IssueLink,
  LevelBadge,
  LevelMeter,
  ReasonChip,
  SimBar,
  Skeleton,
  levelInfo,
} from './components.jsx';
import { formatDate, formatShortDate, parseDate, plural } from './format.js';
import './analysis.css';

// ---------- verdict strip ----------
export function statsLine(stats) {
  if (!stats) return '';
  const n = stats.matchCount ?? 0;
  if (!n) return `No similar events · ${stats.windowMonths || 12} months`;
  return `${plural(n, 'similar event')} · ${stats.windowMonths || 12} months`;
}

export function Verdict({ analysis, compact = false, rechecking = false }) {
  const info = levelInfo(analysis.level);
  return (
    <section
      className={`rr-verdict rr-tone-${info.tone}${compact ? ' is-compact' : ''}`}
      aria-label="Recurrence result"
    >
      <div className="rr-verdict-top">
        <LevelBadge level={analysis.level} />
        <LevelMeter level={analysis.level} />
        <span className="rr-verdict-hint">{info.hint}</span>
        {rechecking && (
          <span className="rr-status rr-verdict-recheck" role="status">
            <CircleNotch size={12} weight="bold" className="rr-spin" aria-hidden="true" />
            Re-checking…
          </span>
        )}
      </div>
      <p className="rr-headline">{analysis.headline}</p>
      <p className="rr-verdict-stats rr-num">{statsLine(analysis.stats)}</p>
    </section>
  );
}

// ---------- CAPA ----------
const CAPA = {
  likely_ineffective: { tone: 'danger', Icon: XCircle, title: "CAPA likely didn't work" },
  effective: { tone: 'success', Icon: CheckCircle, title: 'CAPA held so far' },
  open: { tone: 'info', Icon: HourglassMedium, title: 'CAPA still open' },
  none: { tone: 'neutral', Icon: MinusCircle, title: 'No CAPA on record' },
};

export const capaInfo = (status) => CAPA[status] || CAPA.none;

export function CapaCallout({ capa, matches = [] }) {
  const status = capa?.status || 'none';
  const info = capaInfo(status);
  const { Icon } = info;

  if (status === 'none') {
    return (
      <section className="rr-capa rr-tone-neutral is-muted" aria-label="CAPA">
        <Icon size={18} weight="bold" className="rr-capa-icon" aria-hidden="true" />
        <div className="rr-capa-body">
          <p className="rr-capa-title">{info.title}</p>
          <p className="rr-capa-detail">None of the matched events has a linked CAPA.</p>
        </div>
      </section>
    );
  }

  const since = capa.recurrencesSince || 0;
  return (
    <section className={`rr-capa rr-tone-${info.tone}`} aria-label="CAPA effectiveness">
      <Icon size={18} weight="bold" className="rr-capa-icon" aria-hidden="true" />
      <div className="rr-capa-body">
        <p className="rr-capa-title">{info.title}</p>
        <p className="rr-capa-line">
          <IssueLink issueKey={capa.issueKey} />
          <span className="rr-capa-summary">{capa.summary}</span>
        </p>
        <p className="rr-capa-detail rr-num">
          {status === 'open' ? 'Opened' : `Closed ${formatDate(capa.closedDate)}`}
          {capa.ownerName && <> · owner {capa.ownerName}</>}
        </p>
        {status === 'likely_ineffective' && (
          <p className="rr-capa-since">
            <strong className="rr-num">{plural(since, 'recurrence')} since</strong>
            {capa.sinceKeys?.length > 0 && (
              <span className="rr-capa-keys">
                {capa.sinceKeys.map((k) => (
                  <IssueLink key={k} issueKey={k} />
                ))}
              </span>
            )}
          </p>
        )}
        {status === 'effective' && <p className="rr-capa-detail">No matching event since it closed.</p>}
        {capa.closedDate && matches.length > 0 && <CapaTimeline capa={capa} matches={matches} />}
      </div>
    </section>
  );
}

// Dots on a time axis with a marker where the CAPA closed. Events after the
// marker are the recurrences. Position + a ring/fill difference carry the
// meaning, not just color; the full story is in the aria-label.
export function CapaTimeline({ capa, matches }) {
  const closed = parseDate(capa.closedDate);
  const today = new Date();
  const points = matches
    .map((m) => ({ key: m.issueKey, date: parseDate(m.eventDate), raw: m.eventDate }))
    .filter((p) => p.date)
    .sort((a, b) => a.date - b.date);
  if (!closed || !points.length) return null;
  const start = Math.min(points[0].date.getTime(), closed.getTime());
  const end = today.getTime();
  const span = Math.max(end - start, 1);
  const x = (t) => 4 + ((t - start) / span) * 92; // keep 4% padding each side

  const after = points.filter((p) => p.date > closed);
  const label = [
    ...points.filter((p) => p.date <= closed).map((p) => `${p.key} on ${formatDate(p.raw)}`),
    `CAPA ${capa.issueKey} closed ${formatDate(capa.closedDate)}`,
    ...after.map((p) => `${p.key} on ${formatDate(p.raw)}`),
    'this issue today',
  ].join(', then ');

  return (
    <div className="rr-tl" role="img" aria-label={`Timeline: ${label}.`}>
      <div className="rr-tl-axis" />
      <div className="rr-tl-after" style={{ left: `${x(closed.getTime())}%` }} />
      <div className="rr-tl-marker" style={{ left: `${x(closed.getTime())}%` }}>
        <span className="rr-tl-marker-label">CAPA closed</span>
      </div>
      {points.map((p) => (
        <span
          key={p.key}
          className={`rr-tl-dot${p.date > closed ? ' is-after' : ''}`}
          style={{ left: `${x(p.date.getTime())}%` }}
          title={`${p.key} · ${formatDate(p.raw)}`}
        />
      ))}
      <span className="rr-tl-dot is-now" style={{ left: '96%' }} title="This issue" />
      <span className="rr-tl-tick" style={{ left: '4%' }}>
        {formatShortDate(new Date(start).toISOString())}
      </span>
      <span className="rr-tl-tick is-end" style={{ left: '96%' }}>
        Now
      </span>
    </div>
  );
}

// ---------- matches ----------
export function MatchRow({ match, compact = false }) {
  return (
    <li className={`rr-match${compact ? ' is-compact' : ''}`}>
      <div className="rr-match-head">
        <IssueLink issueKey={match.issueKey} />
        <span className="rr-match-date rr-num">{formatDate(match.eventDate)}</span>
        <span className="rr-match-spacer" />
        <SimBar value={match.sim} />
      </div>
      <p className="rr-match-summary">{match.summary}</p>
      {!compact && match.reasons?.length > 0 && (
        <div className="rr-match-reasons" aria-label="Why it matched">
          {match.reasons.map((r) => (
            <ReasonChip key={`${r.type}-${r.label}`} type={r.type} label={r.label} />
          ))}
        </div>
      )}
      {!compact && (match.rootCause || match.resolverName) && (
        <p className="rr-match-meta">
          {match.rootCause && <>Root cause: {match.rootCause}</>}
          {match.rootCause && match.resolverName && ' · '}
          {match.resolverName && <>resolved by {match.resolverName}</>}
        </p>
      )}
    </li>
  );
}

// ---------- states ----------
export function AnalysisSkeleton({ compact = false }) {
  return (
    <div className="rr-skeleton-wrap" aria-busy="true" aria-label="Loading recurrence check">
      <div className="rr-verdict rr-tone-neutral">
        <Skeleton width={72} height={20} />
        <Skeleton width="85%" height={20} style={{ marginTop: 12 }} />
        <Skeleton width="50%" height={12} style={{ marginTop: 8 }} />
      </div>
      {!compact && <Skeleton height={92} style={{ marginTop: 16, borderRadius: 6 }} />}
      {[0, 1, 2].slice(0, compact ? 2 : 3).map((i) => (
        <div key={i} style={{ marginTop: 16 }}>
          <Skeleton width="40%" height={12} />
          <Skeleton width="90%" height={12} style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

export function PendingState({ timedOut, onRerun }) {
  if (timedOut) {
    return (
      <EmptyState
        icon={HourglassMedium}
        title="Still working on it"
        tone="neutral"
        action={
          <Button icon={ArrowClockwise} onClick={onRerun}>
            Re-run check
          </Button>
        }
      >
        <p>The check is taking longer than usual. Try again in a moment.</p>
      </EmptyState>
    );
  }
  return (
    <div className="rr-pending" role="status">
      <span className="rr-pending-sweep" aria-hidden="true" />
      <div>
        <p className="rr-empty-title">Checking past events…</p>
        <p className="rr-subtle">Comparing this issue with earlier deviations and CAPAs. Usually under 10 seconds.</p>
      </div>
    </div>
  );
}

export function NotTrackedState({ reason }) {
  if (reason === 'CAPA' || reason === 'SOP') {
    return (
      <EmptyState icon={reason === 'CAPA' ? ClipboardText : BookOpen} title={`This is a ${reason} record`}>
        <p>Recurrence Radar checks deviations. Open a deviation linked to this {reason} to see its history.</p>
      </EmptyState>
    );
  }
  return (
    <EmptyState icon={FolderDashed} title="This project isn't watched yet">
      <p>Recurrence Radar only checks deviations in watched projects.</p>
      <p>
        A Jira admin can add it in <strong>Jira settings → Apps → Recurrence Radar</strong>.
      </p>
    </EmptyState>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <EmptyState
      icon={WarningCircle}
      tone="danger"
      title="The check didn't finish"
      action={
        onRetry && (
          <Button icon={ArrowClockwise} onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      <p>{message || 'Something went wrong while reading issue history.'}</p>
    </EmptyState>
  );
}
