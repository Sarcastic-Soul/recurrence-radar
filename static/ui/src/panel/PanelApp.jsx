import { useState } from 'react';
import { ArrowClockwise, FileText, BookOpen, UsersThree } from '@phosphor-icons/react';
import { useAnalysis } from '../shared/useAnalysis.js';
import { Button, IssueLink, MethodTag, RelativeTime } from '../shared/components.jsx';
import {
  AnalysisSkeleton,
  CapaCallout,
  ErrorState,
  MatchRow,
  NotTrackedState,
  PendingState,
  Verdict,
} from '../shared/analysis.jsx';
import { formatDate } from '../shared/format.js';
import DraftView from './DraftView.jsx';

export default function PanelApp() {
  const { phase, analysis, llm, reason, message, rerun, refresh } = useAnalysis();
  const [draftOpen, setDraftOpen] = useState(false);

  let body;
  if (phase === 'loading') body = <AnalysisSkeleton />;
  else if (phase === 'not_tracked') body = <NotTrackedState reason={reason} />;
  else if (phase === 'error' && !analysis) body = <ErrorState message={message} onRetry={refresh} />;
  else if ((phase === 'pending' || phase === 'timeout') && !analysis) {
    body = <PendingState timedOut={phase === 'timeout'} onRerun={rerun} />;
  } else if (analysis) {
    body = (
      <Result
        analysis={analysis}
        phase={phase}
        message={message}
        llm={llm}
        onRerun={rerun}
        draftOpen={draftOpen}
        onDraft={() => setDraftOpen(true)}
        onCloseDraft={() => setDraftOpen(false)}
      />
    );
  }

  return <main className="rr-panel">{body}</main>;
}

function Result({ analysis, phase, message, llm, onRerun, draftOpen, onDraft, onCloseDraft }) {
  const matches = analysis.matches || [];
  const rechecking = phase === 'pending';
  return (
    <>
      <Verdict analysis={analysis} rechecking={rechecking} />

      {phase === 'error' && (
        <p className="rr-inline-error" role="alert">
          Last re-check failed: {message}
        </p>
      )}
      {phase === 'timeout' && (
        <p className="rr-inline-error" role="status">
          Re-check is taking longer than usual. Showing the last result.
        </p>
      )}

      {(analysis.capa?.status !== 'none' || matches.length > 0) && (
        <CapaCallout capa={analysis.capa} matches={matches} />
      )}

      {matches.length > 0 && (
        <section className="rr-section" aria-labelledby="rr-matches-h">
          <div className="rr-section-head">
            <h2 id="rr-matches-h" className="rr-label">
              Similar events
            </h2>
            <span className="rr-label rr-section-aside">Similarity</span>
          </div>
          <ol className="rr-match-list">
            {matches.map((m) => (
              <MatchRow key={m.issueKey} match={m} />
            ))}
          </ol>
        </section>
      )}

      {(analysis.sop || analysis.experts?.length > 0) && (
        <dl className="rr-facts">
          {analysis.sop && (
            <div className="rr-fact">
              <dt className="rr-label">
                <BookOpen size={12} weight="bold" aria-hidden="true" /> SOP
              </dt>
              <dd>
                {analysis.sop.issueKey ? (
                  <IssueLink issueKey={analysis.sop.issueKey}>{analysis.sop.sopRef}</IssueLink>
                ) : (
                  <span className="rr-mono rr-strong">{analysis.sop.sopRef}</span>
                )}{' '}
                <span>{analysis.sop.title}</span>
                <span className="rr-fact-meta rr-num">
                  {analysis.sop.lastRevised && <>revised {formatDate(analysis.sop.lastRevised)} · </>}
                  in {analysis.sop.count} of {analysis.stats?.matchCount || analysis.sop.count} events
                </span>
              </dd>
            </div>
          )}
          {analysis.experts?.length > 0 && (
            <div className="rr-fact">
              <dt className="rr-label">
                <UsersThree size={12} weight="bold" aria-hidden="true" /> Ask
              </dt>
              <dd>
                <ul className="rr-experts">
                  {analysis.experts.map((e) => (
                    <li key={e.name}>
                      <span className="rr-strong">{e.name}</span>
                      <span className="rr-fact-meta rr-num">{expertLine(e)}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      )}

      {draftOpen ? (
        <DraftView onClose={onCloseDraft} />
      ) : (
        <footer className="rr-footer">
          <div className="rr-footer-actions">
            <Button variant="primary" icon={FileText} onClick={onDraft}>
              Draft investigation
            </Button>
            <Button variant="subtle" icon={ArrowClockwise} onClick={onRerun} loading={rechecking}>
              {rechecking ? 'Checking' : 'Re-run'}
            </Button>
          </div>
          <p className="rr-footer-meta">
            <MethodTag method={analysis.method} />
            <span aria-hidden="true">·</span>
            <span>
              Updated <RelativeTime value={analysis.computedAt} />
            </span>
            {llm && !llm.available && analysis.method !== 'llm' && (
              <>
                <span aria-hidden="true">·</span>
                <span>AI off</span>
              </>
            )}
          </p>
        </footer>
      )}
    </>
  );
}

function expertLine(e) {
  const parts = [];
  if (e.resolved) parts.push(`resolved ${e.resolved} of ${e.of}`);
  if (e.capaOwned) parts.push(`owned ${e.capaOwned === 1 ? 'the CAPA' : `${e.capaOwned} CAPAs`}`);
  if (!parts.length) parts.push(`involved in ${e.of > 1 ? 'past events' : 'a past event'}`);
  return parts.join(' · ');
}
