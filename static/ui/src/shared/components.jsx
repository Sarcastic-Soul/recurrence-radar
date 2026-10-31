import { useEffect, useState } from 'react';
import {
  WarningOctagon,
  WarningCircle,
  Info,
  CheckCircle,
  Gear,
  Pulse,
  Pill,
  Hash,
  TreeStructure,
  CircleNotch,
  Robot,
  ListChecks,
} from '@phosphor-icons/react';
import { openIssue } from './api.js';
import { relativeTime } from './format.js';

export const LEVELS = {
  HIGH: { label: 'High', tone: 'danger', Icon: WarningOctagon, rank: 3, hint: 'Likely recurrence' },
  MEDIUM: { label: 'Medium', tone: 'warning', Icon: WarningCircle, rank: 2, hint: 'Possible recurrence' },
  LOW: { label: 'Low', tone: 'info', Icon: Info, rank: 1, hint: 'Weak match' },
  NONE: { label: 'None', tone: 'neutral', Icon: CheckCircle, rank: 0, hint: 'No recurrence found' },
};

export const levelInfo = (level) => LEVELS[level] || LEVELS.NONE;

// Lozenge: icon + text so the level never depends on color alone.
export function LevelBadge({ level, bold = false }) {
  const info = levelInfo(level);
  const { Icon } = info;
  return (
    <span className={`rr-lozenge rr-tone-${info.tone}${bold ? ' is-bold' : ''}`}>
      <Icon size={12} weight="bold" aria-hidden="true" />
      {info.label}
    </span>
  );
}

// Four-step signal meter. Filled steps = level rank (NONE fills none).
export function LevelMeter({ level }) {
  const info = levelInfo(level);
  return (
    <span className={`rr-meter rr-tone-${info.tone}`} aria-hidden="true">
      {[1, 2, 3].map((step) => (
        <span key={step} className={step <= info.rank ? 'is-on' : ''} style={{ height: 4 + step * 3 }} />
      ))}
    </span>
  );
}

const REASON_ICONS = {
  equipment: { Icon: Gear, name: 'Same equipment' },
  failureMode: { Icon: Pulse, name: 'Same failure mode' },
  product: { Icon: Pill, name: 'Same product' },
  keywords: { Icon: Hash, name: 'Shared words' },
  rootCause: { Icon: TreeStructure, name: 'Same root cause' },
};

export function ReasonChip({ type, label }) {
  const r = REASON_ICONS[type] || REASON_ICONS.keywords;
  const { Icon } = r;
  return (
    <span className="rr-chip" title={`${r.name}: ${label}`}>
      <Icon size={12} weight="bold" aria-hidden="true" />
      <span className="rr-visually-hidden">{r.name}: </span>
      {label}
    </span>
  );
}

export function IssueLink({ issueKey, children, className = '' }) {
  if (!issueKey) return null;
  return (
    <a
      href={`/browse/${issueKey}`}
      className={`rr-issue-link ${className}`}
      onClick={(e) => {
        e.preventDefault();
        openIssue(issueKey, e.metaKey || e.ctrlKey);
      }}
    >
      {children || issueKey}
    </a>
  );
}

export function SimBar({ value }) {
  const pct = Math.max(0, Math.min(1, value || 0));
  return (
    <span className="rr-sim" title={`Similarity ${Math.round(pct * 100)}%`}>
      <span className="rr-sim-track" aria-hidden="true">
        <span className="rr-sim-fill" style={{ width: `${pct * 100}%` }} />
      </span>
      <span className="rr-sim-num">
        <span className="rr-visually-hidden">Similarity </span>
        {Math.round(pct * 100)}
        <span className="rr-sim-unit">%</span>
      </span>
    </span>
  );
}

export function Button({ variant = 'default', icon: Icon, loading, children, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`rr-btn rr-btn-${variant} ${className}`}
      aria-busy={loading || undefined}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? (
        <CircleNotch size={14} weight="bold" className="rr-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon size={14} weight="bold" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export function Skeleton({ width = '100%', height = 12, style }) {
  return <span className="rr-skel" style={{ width, height, ...style }} aria-hidden="true" />;
}

export function EmptyState({ icon: Icon, title, children, action, tone = 'neutral' }) {
  return (
    <div className={`rr-empty rr-tone-${tone}`}>
      {Icon && <Icon size={24} weight="duotone" className="rr-empty-icon" aria-hidden="true" />}
      <div>
        <p className="rr-empty-title">{title}</p>
        {children && <div className="rr-empty-body">{children}</div>}
        {action && <div className="rr-empty-action">{action}</div>}
      </div>
    </div>
  );
}

// Updates its own text every 30 s so "2 min ago" stays true.
export function RelativeTime({ value }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);
  if (!value) return null;
  return (
    <time dateTime={value} title={new Date(value).toLocaleString()}>
      {relativeTime(value)}
    </time>
  );
}

export function MethodTag({ method }) {
  const ai = method === 'llm';
  const Icon = ai ? Robot : ListChecks;
  return (
    <span className="rr-method">
      <Icon size={12} weight="bold" aria-hidden="true" />
      {ai ? 'AI-assisted' : 'Matched by rules'}
    </span>
  );
}

// Reads the mock flag events in dev so flags are visible without Jira.
export function MockFlags() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const onFlag = (e) => {
      const id = Math.random();
      setItems((list) => [...list, { ...e.detail, id }]);
      setTimeout(() => setItems((list) => list.filter((f) => f.id !== id)), 3500);
    };
    window.addEventListener('rr-mock-flag', onFlag);
    return () => window.removeEventListener('rr-mock-flag', onFlag);
  }, []);
  if (!items.length) return null;
  return (
    <div className="rr-mock-flags" role="status">
      {items.map((f) => (
        <div key={f.id} className={`rr-mock-flag rr-tone-${f.type === 'error' ? 'danger' : f.type}`}>
          <strong>{f.title}</strong>
          {f.description && <span>{f.description}</span>}
        </div>
      ))}
    </div>
  );
}
