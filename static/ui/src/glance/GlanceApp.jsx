import { ArrowDown } from '@phosphor-icons/react';
import { useAnalysis } from '../shared/useAnalysis.js';
import { IssueLink, MethodTag, RelativeTime } from '../shared/components.jsx';
import {
  AnalysisSkeleton,
  ErrorState,
  MatchRow,
  NotTrackedState,
  PendingState,
  Verdict,
  capaInfo,
} from '../shared/analysis.jsx';
import { formatDate, plural } from '../shared/format.js';

export default function GlanceApp() {
  const { phase, analysis, reason, message, rerun, refresh } = useAnalysis();

  let body;
  if (phase === 'loading') body = <AnalysisSkeleton compact />;
  else if (phase === 'not_tracked') body = <NotTrackedState reason={reason} />;
  else if (phase === 'error' && !analysis) body = <ErrorState message={message} onRetry={refresh} />;
  else if ((phase === 'pending' || phase === 'timeout') && !analysis) {
    body = <PendingState timedOut={phase === 'timeout'} onRerun={rerun} />;
  } else if (analysis) {
    const top = (analysis.matches || []).slice(0, 3);
    body = (
      <>
        <Verdict analysis={analysis} compact rechecking={phase === 'pending'} />
        <CapaLine capa={analysis.capa} />
        {top.length > 0 && (
          <section className="rr-glance-matches" aria-labelledby="rr-g-matches">
            <h2 id="rr-g-matches" className="rr-label">
              Top matches
              {analysis.stats?.matchCount > top.length && (
                <span className="rr-subtlest">
                  {' '}
                  · {top.length} of {analysis.stats.matchCount}
                </span>
              )}
            </h2>
            <ol className="rr-match-list">
              {top.map((m) => (
                <MatchRow key={m.issueKey} match={m} compact />
              ))}
            </ol>
          </section>
        )}
        <p className="rr-glance-hint">
          <ArrowDown size={12} weight="bold" aria-hidden="true" />
          Full details, experts and the investigation draft are in the Recurrence Radar panel on this issue.
        </p>
        <p className="rr-glance-meta">
          <MethodTag method={analysis.method} />
          <span aria-hidden="true">·</span>
          <RelativeTime value={analysis.computedAt} />
        </p>
      </>
    );
  }
  return <main className="rr-glance">{body}</main>;
}

function CapaLine({ capa }) {
  const status = capa?.status || 'none';
  const info = capaInfo(status);
  const { Icon } = info;
  let detail = null;
  if (status === 'likely_ineffective') {
    detail = (
      <>
        closed {formatDate(capa.closedDate)} · {plural(capa.recurrencesSince || 0, 'recurrence')} since
      </>
    );
  } else if (status === 'effective') {
    detail = <>closed {formatDate(capa.closedDate)} · no repeat since</>;
  } else if (status === 'open') {
    detail = <>{capa.ownerName ? `owner ${capa.ownerName}` : 'in progress'}</>;
  }
  return (
    <div className={`rr-capa-line-compact rr-tone-${info.tone}`}>
      <Icon size={16} weight="bold" aria-hidden="true" />
      <div>
        <p className="rr-capa-compact-title">
          {info.title}
          {capa?.issueKey && status !== 'none' && (
            <>
              {' '}
              · <IssueLink issueKey={capa.issueKey} />
            </>
          )}
        </p>
        {detail && <p className="rr-capa-compact-detail rr-num">{detail}</p>}
      </div>
    </div>
  );
}
