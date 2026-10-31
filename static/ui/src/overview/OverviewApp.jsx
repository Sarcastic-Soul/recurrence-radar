import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowClockwise, ChartBar, FolderDashed, Table, XCircle } from '@phosphor-icons/react';
import { api, errorMessage } from '../shared/api.js';
import { Button, EmptyState, IssueLink, LevelBadge, Skeleton } from '../shared/components.jsx';
import { formatDate, formatMonth, plural } from '../shared/format.js';
import { ErrorState } from '../shared/analysis.jsx';

export default function OverviewApp() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.getOverview());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="rr-ov">
      <header className="rr-ov-head">
        <div>
          <h1>Recurrence overview</h1>
          <p className="rr-subtle">
            Repeat deviations and CAPAs that did not hold{data?.projectKey ? ` in ${data.projectKey}` : ''}.
          </p>
        </div>
        <Button variant="subtle" icon={ArrowClockwise} onClick={load} loading={loading && !!data}>
          Refresh
        </Button>
      </header>
      {error && !data && <ErrorState message={error} onRetry={load} />}
      {!data && !error && <OverviewSkeleton />}
      {data && <Body data={data} />}
    </main>
  );
}

function Body({ data }) {
  if (data.watched === false) {
    return (
      <EmptyState icon={FolderDashed} title="This project isn't watched yet">
        <p>Recurrence Radar only checks deviations in watched projects.</p>
        <p>
          A Jira admin can add {data.projectKey || 'it'} in <strong>Jira settings → Apps → Recurrence Radar</strong>.
        </p>
      </EmptyState>
    );
  }
  const t = data.totals || {};
  if (!t.deviations) {
    return (
      <EmptyState icon={ChartBar} title="No deviations checked yet">
        <p>New deviations show up here once they are created in this project.</p>
        <p>
          To see it with sample data, open <strong>Jira settings → Apps → Recurrence Radar</strong> and load the demo
          QMS.
        </p>
      </EmptyState>
    );
  }
  return (
    <>
      <dl className="rr-kpis">
        <Kpi label="Deviations checked" value={t.deviations} />
        <Kpi label="High recurrence" value={t.high} tone="danger" />
        <Kpi label="Medium recurrence" value={t.medium} tone="warning" />
        <Kpi label="CAPAs likely not working" value={t.ineffectiveCapas} tone="danger" />
      </dl>

      <div className="rr-ov-grid">
        <section className="rr-ov-section rr-ov-wide" aria-labelledby="rr-high-h">
          <SectionHead id="rr-high-h" title="Open high deviations" count={data.openHigh?.length} />
          {data.openHigh?.length ? (
            <div className="rr-table-wrap">
              <table className="rr-table">
                <thead>
                  <tr>
                    <th scope="col">Issue</th>
                    <th scope="col">Summary</th>
                    <th scope="col">Level</th>
                    <th scope="col" className="rr-col-date">
                      Raised
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.openHigh.map((row) => (
                    <tr key={row.issueKey}>
                      <td>
                        <IssueLink issueKey={row.issueKey} />
                      </td>
                      <td>
                        <span className="rr-cell-summary">{row.summary}</span>
                        {row.headline && <span className="rr-cell-headline">{row.headline}</span>}
                      </td>
                      <td>
                        <LevelBadge level={row.level} />
                      </td>
                      <td className="rr-col-date rr-num">{formatDate(row.eventDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rr-none">No open high deviations. Good.</p>
          )}
        </section>

        <section className="rr-ov-section" aria-labelledby="rr-capa-h">
          <SectionHead id="rr-capa-h" title="CAPAs that likely didn't work" count={data.ineffectiveCapas?.length} />
          {data.ineffectiveCapas?.length ? (
            <ul className="rr-capa-list">
              {data.ineffectiveCapas.map((c) => (
                <li key={c.issueKey}>
                  <XCircle size={16} weight="bold" className="rr-capa-list-icon" aria-hidden="true" />
                  <div>
                    <p>
                      <IssueLink issueKey={c.issueKey} /> <span>{c.summary}</span>
                    </p>
                    <p className="rr-capa-list-meta rr-num">
                      Closed {formatDate(c.closedDate)} ·{' '}
                      <strong>{plural(c.recurrencesSince, 'recurrence')} since</strong>
                      {c.sinceKeys?.length > 0 && (
                        <span className="rr-capa-list-keys">
                          {c.sinceKeys.map((k) => (
                            <IssueLink key={k} issueKey={k} />
                          ))}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rr-none">No closed CAPA has a repeat event after it.</p>
          )}
        </section>

        <section className="rr-ov-section" aria-labelledby="rr-time-h">
          <Timeline id="rr-time-h" timeline={data.timeline || []} />
        </section>

        <section className="rr-ov-section" aria-labelledby="rr-eq-h">
          <SectionHead id="rr-eq-h" title="Top equipment" />
          <Bars items={data.topEquipment} unit="deviation" />
        </section>

        <section className="rr-ov-section" aria-labelledby="rr-fm-h">
          <SectionHead id="rr-fm-h" title="Top failure modes" />
          <Bars items={data.topFailureModes} unit="deviation" />
        </section>
      </div>
    </>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className={`rr-kpi${tone ? ` rr-tone-${tone}` : ''}`}>
      <dt>{label}</dt>
      <dd className="rr-num">{value ?? 0}</dd>
    </div>
  );
}

function SectionHead({ id, title, count, children }) {
  return (
    <div className="rr-ov-section-head">
      <h2 id={id}>
        {title}
        {count > 0 && <span className="rr-count rr-num">{count}</span>}
      </h2>
      {children}
    </div>
  );
}

function Bars({ items = [], unit }) {
  if (!items.length) return <p className="rr-none">Nothing to show yet.</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="rr-bars">
      {items.map((item) => (
        <li key={item.name}>
          <span className="rr-bar-name">{item.name}</span>
          <span className="rr-bar-track" aria-hidden="true">
            <span className="rr-bar-fill" style={{ width: `${(item.count / max) * 100}%` }} />
          </span>
          <span className="rr-bar-count rr-num">
            {item.count}
            <span className="rr-visually-hidden"> {item.count === 1 ? unit : `${unit}s`}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Monthly deviation counts: single series, so no legend; the heading names it.
function Timeline({ id, timeline }) {
  const [asTable, setAsTable] = useState(false);
  const n = timeline.length;
  return (
    <>
      <SectionHead id={id} title="Deviations per month">
        {n > 0 && (
          <button type="button" className="rr-textlink rr-view-toggle" onClick={() => setAsTable((v) => !v)}>
            {asTable ? (
              <ChartBar size={14} weight="bold" aria-hidden="true" />
            ) : (
              <Table size={14} weight="bold" aria-hidden="true" />
            )}
            {asTable ? 'Show chart' : 'Show table'}
          </button>
        )}
      </SectionHead>
      {!n && <p className="rr-none">Nothing to show yet.</p>}
      {n > 0 && asTable && (
        <div className="rr-table-wrap rr-table-scroll">
          <table className="rr-table rr-table-compact">
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col" className="rr-col-num">
                  Deviations
                </th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((t) => (
                <tr key={t.month}>
                  <td>{formatMonth(t.month, true)}</td>
                  <td className="rr-col-num rr-num">{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {n > 0 && !asTable && <TimelineChart timeline={timeline} />}
    </>
  );
}

function TimelineChart({ timeline }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const n = timeline.length;
  const H = 140;
  const pad = { top: 18, right: 4, bottom: 22, left: 24 };
  const max = Math.max(...timeline.map((t) => t.count), 1);
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 2) * 2;
  const innerW = Math.max(width - pad.left - pad.right, 0);
  const innerH = H - pad.top - pad.bottom;
  const slot = n ? innerW / n : 0;
  const barW = Math.max(Math.min(slot - 2, 22), 2);
  const y = (v) => pad.top + innerH - (v / niceMax) * innerH;
  const total = timeline.reduce((s, t) => s + t.count, 0);
  const peak = timeline.reduce((best, t, i) => (t.count > (timeline[best]?.count ?? -1) ? i : best), 0);

  return (
    <div className="rr-chart" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`Deviations per month, ${formatMonth(timeline[0].month, true)} to ${formatMonth(timeline[n - 1].month, true)}. ${total} in total, peak ${timeline[peak].count} in ${formatMonth(timeline[peak].month, true)}.`}
          onMouseLeave={() => setHover(null)}
        >
          {[0, niceMax / 2, niceMax].map((v) => (
            <g key={v}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(v)}
                y2={y(v)}
                className={v === 0 ? 'rr-axis' : 'rr-grid'}
              />
              <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" className="rr-tick">
                {v}
              </text>
            </g>
          ))}
          {timeline.map((t, i) => {
            const cx = pad.left + slot * i + slot / 2;
            const h = Math.max(y(0) - y(t.count), t.count ? 2 : 0);
            const showLabel = i === 0 || i === n - 1 || t.month.endsWith('-01');
            return (
              <g key={t.month}>
                <rect
                  x={cx - barW / 2}
                  y={y(0) - h}
                  width={barW}
                  height={h}
                  rx={Math.min(3, barW / 2)}
                  className={`rr-bar${hover === i ? ' is-hover' : ''}${i === peak ? ' is-peak' : ''}`}
                />
                {i === peak && (
                  <text x={cx} y={y(t.count) - 5} textAnchor="middle" className="rr-bar-label">
                    {t.count}
                  </text>
                )}
                {showLabel && (
                  <text
                    x={cx}
                    y={H - 6}
                    textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                    dx={i === 0 ? -barW / 2 : i === n - 1 ? barW / 2 : 0}
                    className="rr-tick"
                  >
                    {formatMonth(t.month, i === 0 || i === n - 1 || t.month.endsWith('-01'))}
                  </text>
                )}
                {/* Hit target wider than the bar */}
                <rect
                  x={pad.left + slot * i}
                  y={pad.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div
          className="rr-tooltip"
          style={{
            left: Math.min(Math.max(pad.left + slot * hover + slot / 2, 50), width - 50),
            top: y(timeline[hover].count) - 8,
          }}
          aria-hidden="true"
        >
          <strong className="rr-num">{timeline[hover].count}</strong> in {formatMonth(timeline[hover].month, true)}
        </div>
      )}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading overview">
      <div className="rr-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rr-kpi">
            <Skeleton width="60%" />
            <Skeleton width={48} height={28} style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
      <Skeleton height={160} style={{ marginTop: 24, borderRadius: 6 }} />
    </div>
  );
}
