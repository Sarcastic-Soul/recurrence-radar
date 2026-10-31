import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Database,
  Trash,
  ArrowSquareOut,
  Copy,
  Check,
  ShieldCheck,
  Robot,
  FloppyDisk,
  WarningCircle,
  CheckCircle,
  CircleNotch,
  Lock,
  Play,
} from '@phosphor-icons/react';
import { api, errorMessage, flag, openPath } from '../shared/api.js';
import { Button, Skeleton } from '../shared/components.jsx';
import { plural } from '../shared/format.js';

const DEMO_STEPS = [
  'Creating issues',
  'Saving history',
  'Linking CAPAs',
  'Closing finished records',
  'Scoring deviations',
];
const POLL_MS = 3000;

export default function AdminApp() {
  const [setup, setSetup] = useState(null);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.getSetup();
      setSetup(res);
      setLoadError('');
      return res;
    } catch (err) {
      setLoadError(errorMessage(err));
      return null;
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="rr-admin">
      <header className="rr-admin-head">
        <h1>Recurrence Radar</h1>
        <p className="rr-subtle">
          Flags deviations that happened before, and CAPAs that did not stop them. Set it up here.
        </p>
      </header>

      {loadError && (
        <p className="rr-inline-error" role="alert">
          Could not load settings: {loadError}{' '}
          <button type="button" className="rr-textlink" onClick={load}>
            Try again
          </button>
        </p>
      )}

      <div className="rr-admin-grid">
        <div className="rr-admin-main">
          {setup && !setup.isAdmin && (
            <p className="rr-notice">
              <Lock size={16} weight="bold" aria-hidden="true" />
              Only Jira admins can change these settings.
            </p>
          )}
          <DemoSection setup={setup} reload={load} />
          <SettingsSection setup={setup} onSaved={(settings) => setSetup((s) => ({ ...s, settings }))} />
        </div>
        <aside className="rr-admin-aside">
          <TryIt />
          <AiStatus setup={setup} />
          <Privacy />
        </aside>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- demo data
function DemoSection({ setup, reload }) {
  const demo = setup?.demo;
  const state = demo?.state || (demo?.loaded ? 'done' : 'none');
  const [mode, setMode] = useState('existing');
  const [projectKey, setProjectKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const prevState = useRef(state);
  const disabled = setup ? !setup.isAdmin : true;

  useEffect(() => {
    if (!projectKey && setup?.projects?.length) {
      const watched = setup.settings?.watchedProjectKeys?.[0];
      setProjectKey(setup.projects.find((p) => p.key === watched)?.key || setup.projects[0].key);
    }
    if (setup && !setup.projects?.length) setMode('create');
  }, [setup, projectKey]);

  // Poll while the background job runs.
  useEffect(() => {
    if (state !== 'running' && state !== 'removing') return undefined;
    const id = setInterval(reload, POLL_MS);
    return () => clearInterval(id);
  }, [state, reload]);

  // Flag when a job finishes.
  useEffect(() => {
    const prev = prevState.current;
    prevState.current = state;
    if (prev === 'running' && state === 'done') {
      flag({ title: 'Demo data loaded', description: `Open ${demo.projectKey} to try it.`, type: 'success' });
    } else if (prev === 'removing' && state === 'none') {
      flag({ title: 'Demo data removed', type: 'success' });
    } else if ((prev === 'running' || prev === 'removing') && state === 'error') {
      flag({ title: 'Demo job failed', description: demo?.error, type: 'error' });
    }
  }, [state, demo]);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.seedDemo(mode === 'create' ? { createProject: true } : { projectKey });
      if (res?.ok === false) setError(res.message || 'Could not start the loader.');
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.removeDemo();
      if (res?.ok === false) setError(res.message || 'Could not start removal.');
      setConfirmRemove(false);
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rr-admin-section rr-demo" aria-labelledby="rr-demo-h">
      <div className="rr-admin-section-head">
        <Database size={18} weight="bold" aria-hidden="true" />
        <h2 id="rr-demo-h">Demo data</h2>
        {state === 'done' && <span className="rr-lozenge rr-tone-success">Loaded</span>}
      </div>
      <p className="rr-subtle rr-admin-lead">
        Loads a small quality system: 40 deviations, 8 CAPAs and 6 SOPs across 18 months, with links between them. Every
        demo issue is labeled <code>rr-demo</code> so it can be removed cleanly.
      </p>

      {!setup && (
        <div className="rr-demo-box">
          <Skeleton width="40%" />
          <Skeleton width="70%" height={36} style={{ marginTop: 12 }} />
        </div>
      )}

      {setup && state === 'none' && (
        <div className="rr-demo-box">
          <fieldset className="rr-radio-group" disabled={disabled}>
            <legend className="rr-visually-hidden">Where to load the demo</legend>
            <label className="rr-radio">
              <input
                type="radio"
                name="demo-mode"
                value="existing"
                checked={mode === 'existing'}
                onChange={() => setMode('existing')}
                disabled={!setup.projects?.length}
              />
              <span>
                <span className="rr-radio-title">Use an existing project</span>
                <span className="rr-field-help">Demo issues are added next to what is already there.</span>
              </span>
            </label>
            {mode === 'existing' && setup.projects?.length > 0 && (
              <div className="rr-radio-indent">
                <label className="rr-visually-hidden" htmlFor="rr-demo-project">
                  Project
                </label>
                <select
                  id="rr-demo-project"
                  className="rr-select"
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value)}
                >
                  {setup.projects.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <label className="rr-radio">
              <input
                type="radio"
                name="demo-mode"
                value="create"
                checked={mode === 'create'}
                onChange={() => setMode('create')}
              />
              <span>
                <span className="rr-radio-title">Create a new demo project</span>
                <span className="rr-field-help">Keeps demo issues apart from real work.</span>
              </span>
            </label>
          </fieldset>
          <div className="rr-demo-actions">
            <Button
              variant="primary"
              icon={Play}
              onClick={start}
              loading={busy}
              disabled={disabled || (mode === 'existing' && !projectKey)}
            >
              Load demo QMS
            </Button>
            <span className="rr-field-help">Takes about a minute. You can leave this page.</span>
          </div>
        </div>
      )}

      {setup && (state === 'running' || state === 'removing') && (
        <DemoProgress demo={demo} removing={state === 'removing'} />
      )}

      {setup && state === 'done' && (
        <div className="rr-demo-box rr-demo-done">
          <dl className="rr-counts">
            <div>
              <dt>Deviations</dt>
              <dd className="rr-num">{demo.counts?.DEV ?? 0}</dd>
            </div>
            <div>
              <dt>CAPAs</dt>
              <dd className="rr-num">{demo.counts?.CAPA ?? 0}</dd>
            </div>
            <div>
              <dt>SOPs</dt>
              <dd className="rr-num">{demo.counts?.SOP ?? 0}</dd>
            </div>
          </dl>
          <div className="rr-demo-actions">
            {demo.projectKey && (
              <Button icon={ArrowSquareOut} onClick={() => openPath(`/browse/${demo.projectKey}`)}>
                Open project {demo.projectKey}
              </Button>
            )}
            {!confirmRemove ? (
              <Button variant="subtle" icon={Trash} onClick={() => setConfirmRemove(true)} disabled={disabled}>
                Remove demo data
              </Button>
            ) : (
              <div className="rr-confirm" role="group" aria-label="Confirm removal">
                <span>
                  Delete{' '}
                  {plural((demo.counts?.DEV ?? 0) + (demo.counts?.CAPA ?? 0) + (demo.counts?.SOP ?? 0), 'demo issue')}?
                  Real issues are not touched.
                </span>
                <Button variant="danger" className="rr-btn-sm" onClick={remove} loading={busy}>
                  Delete
                </Button>
                <Button variant="subtle" className="rr-btn-sm" onClick={() => setConfirmRemove(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {setup && state === 'error' && (
        <div className="rr-demo-box">
          <p className="rr-error-line" role="alert">
            <WarningCircle size={16} weight="bold" aria-hidden="true" />
            The demo job stopped: {demo?.error || 'unknown error'}
          </p>
          <div className="rr-demo-actions">
            <Button onClick={start} loading={busy} disabled={disabled}>
              Try again
            </Button>
            <Button variant="subtle" icon={Trash} onClick={remove} disabled={disabled || busy}>
              Clean up partial data
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="rr-inline-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function DemoProgress({ demo, removing }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const started = demo?.startedAt ? new Date(demo.startedAt).getTime() : null;
  const elapsed = started ? Math.max(0, Math.round((now - started) / 1000)) : null;
  const current = DEMO_STEPS.indexOf(demo?.step);

  return (
    <div className="rr-demo-box" role="status" aria-live="polite">
      <div className="rr-progress-head">
        <span className="rr-strong">
          {removing ? 'Removing demo data…' : `Loading demo data${demo?.projectKey ? ` into ${demo.projectKey}` : ''}…`}
        </span>
        {elapsed !== null && <span className="rr-num rr-subtlest">{fmtElapsed(elapsed)}</span>}
      </div>
      <div className="rr-progress" aria-hidden="true">
        <span />
      </div>
      {!removing && (
        <ol className="rr-steps">
          {DEMO_STEPS.map((step, i) => {
            const done = current > i;
            const active = current === i;
            return (
              <li key={step} className={done ? 'is-done' : active ? 'is-active' : ''}>
                {done ? (
                  <CheckCircle size={14} weight="fill" aria-hidden="true" />
                ) : active ? (
                  <CircleNotch size={14} weight="bold" className="rr-spin" aria-hidden="true" />
                ) : (
                  <span className="rr-step-dot" aria-hidden="true" />
                )}
                <span>{step}</span>
                <span className="rr-visually-hidden">{done ? ' (done)' : active ? ' (in progress)' : ''}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

const fmtElapsed = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`);

// ---------------------------------------------------------------- settings
function SettingsSection({ setup, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const disabled = !setup?.isAdmin;

  useEffect(() => {
    if (setup?.settings && !form) setForm(setup.settings);
  }, [setup, form]);

  const dirty = useMemo(() => form && JSON.stringify(form) !== JSON.stringify(setup?.settings), [form, setup]);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const toggleProject = (key) => {
    const keys = new Set(form.watchedProjectKeys || []);
    if (keys.has(key)) keys.delete(key);
    else keys.add(key);
    set('watchedProjectKeys', [...keys]);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, llmDailyCap: Math.max(0, Number(form.llmDailyCap) || 0) };
      const res = await api.saveSettings(payload);
      if (res?.ok === false) throw new Error(res.message || 'Settings were not saved.');
      const saved = res?.settings || payload;
      setForm(saved);
      onSaved(saved);
      flag({ title: 'Settings saved', type: 'success' });
    } catch (err) {
      flag({ title: 'Could not save settings', description: errorMessage(err), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rr-admin-section" aria-labelledby="rr-settings-h">
      <div className="rr-admin-section-head">
        <h2 id="rr-settings-h">Settings</h2>
      </div>
      {!form ? (
        <div className="rr-settings-skel">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={36} />
          ))}
        </div>
      ) : (
        <form className="rr-settings" onSubmit={save}>
          <fieldset className="rr-field" disabled={disabled}>
            <legend className="rr-field-label">Watched projects</legend>
            <div className="rr-checks">
              {(setup.projects || []).map((p) => {
                const on = form.watchedProjectKeys?.includes(p.key);
                return (
                  <label key={p.key} className={`rr-check${on ? ' is-on' : ''}`}>
                    <input type="checkbox" checked={!!on} onChange={() => toggleProject(p.key)} />
                    <span className="rr-mono">{p.key}</span>
                    <span className="rr-check-name">{p.name}</span>
                  </label>
                );
              })}
            </div>
            <span className="rr-field-help">New and edited issues in these projects are checked automatically.</span>
          </fieldset>

          <div className="rr-field-row">
            <label className="rr-field">
              <span className="rr-field-label">CAPA label</span>
              <input
                className="rr-input"
                value={form.capaLabel || ''}
                onChange={(e) => set('capaLabel', e.target.value)}
                disabled={disabled}
              />
            </label>
            <label className="rr-field">
              <span className="rr-field-label">SOP label</span>
              <input
                className="rr-input"
                value={form.sopLabel || ''}
                onChange={(e) => set('sopLabel', e.target.value)}
                disabled={disabled}
              />
            </label>
            <label className="rr-field">
              <span className="rr-field-label">
                Deviation label <span className="rr-subtlest">(optional)</span>
              </span>
              <input
                className="rr-input"
                value={form.deviationLabel || ''}
                placeholder="any issue"
                onChange={(e) => set('deviationLabel', e.target.value)}
                disabled={disabled}
              />
            </label>
          </div>
          <span className="rr-field-help rr-field-help-row">
            Issues with the CAPA or SOP label are treated as records, not deviations.
          </span>

          <div className="rr-field-row rr-field-row-2">
            <div className="rr-field">
              <span className="rr-field-label" id="rr-ai-label">
                Use AI (Forge LLM)
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={!!form.llmEnabled}
                aria-labelledby="rr-ai-label"
                className={`rr-switch${form.llmEnabled ? ' is-on' : ''}`}
                onClick={() => set('llmEnabled', !form.llmEnabled)}
                disabled={disabled}
              >
                <span className="rr-switch-knob" />
                <span className="rr-switch-text">{form.llmEnabled ? 'On' : 'Off'}</span>
              </button>
              <span className="rr-field-help">
                Reads free text better and writes drafts. Rules still work when off.
              </span>
            </div>
            <label className="rr-field">
              <span className="rr-field-label">Daily AI call limit</span>
              <input
                className="rr-input rr-num"
                type="number"
                min={0}
                step={10}
                value={form.llmDailyCap}
                onChange={(e) => set('llmDailyCap', e.target.value)}
                disabled={disabled || !form.llmEnabled}
              />
              <span className="rr-field-help">Falls back to rules once reached.</span>
            </label>
          </div>

          <div className="rr-field">
            <label className="rr-field-label" htmlFor="rr-threshold">
              Match threshold <span className="rr-threshold-val rr-num">{Number(form.matchThreshold).toFixed(2)}</span>
            </label>
            <input
              id="rr-threshold"
              className="rr-range"
              type="range"
              min={0.3}
              max={0.8}
              step={0.01}
              value={form.matchThreshold}
              onChange={(e) => set('matchThreshold', Number(e.target.value))}
              disabled={disabled}
            />
            <div className="rr-range-ends rr-field-help">
              <span>0.30 · more matches</span>
              <span>stricter · 0.80</span>
            </div>
          </div>

          <div className="rr-settings-actions">
            <Button type="submit" variant="primary" icon={FloppyDisk} loading={saving} disabled={disabled || !dirty}>
              Save settings
            </Button>
            {dirty && (
              <Button variant="subtle" onClick={() => setForm(setup.settings)}>
                Discard changes
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- aside
const DEMO_SUMMARY = 'Tablet weight out of spec on Press 4 during compression, batch B2291';
const DEMO_DESCRIPTION =
  'During routine IPC checks at 35 min, tablet weights on Press 4 trended low (average 487 mg, limit 495–505 mg). Compression stopped and the batch put on hold.';

function TryIt() {
  const [copied, setCopied] = useState('');
  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(what);
    setTimeout(() => setCopied(''), 2000);
  };
  return (
    <section className="rr-aside-block rr-tryit" aria-labelledby="rr-try-h">
      <h2 id="rr-try-h" className="rr-aside-title">
        Try it
      </h2>
      <ol className="rr-try-steps">
        <li>Load the demo data.</li>
        <li>Create an issue in the demo project with this summary:</li>
      </ol>
      <div className="rr-copybox">
        <p className="rr-copybox-text">{DEMO_SUMMARY}</p>
        <Button
          className="rr-btn-sm"
          icon={copied === 's' ? Check : Copy}
          onClick={() => copy('s', DEMO_SUMMARY)}
          aria-label="Copy summary"
        >
          {copied === 's' ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="rr-field-help rr-try-optional">Optional description:</p>
      <div className="rr-copybox is-quiet">
        <p className="rr-copybox-text">{DEMO_DESCRIPTION}</p>
        <Button
          variant="subtle"
          className="rr-btn-sm"
          icon={copied === 'd' ? Check : Copy}
          onClick={() => copy('d', DEMO_DESCRIPTION)}
          aria-label="Copy description"
        >
          {copied === 'd' ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <ol className="rr-try-steps" start={3}>
        <li>Open the issue. The Recurrence Radar panel shows the result within a few seconds.</li>
      </ol>
    </section>
  );
}

function AiStatus({ setup }) {
  const llm = setup?.llm;
  const enabled = setup?.settings?.llmEnabled;
  const used = llm?.callsToday ?? 0;
  const cap = llm?.cap || setup?.settings?.llmDailyCap || 0;
  const ratio = cap ? Math.min(1, used / cap) : 0;
  let label = 'Checking…';
  let tone = 'neutral';
  if (llm) {
    if (!llm.available) {
      label = 'Not available on this site';
      tone = 'warning';
    } else if (!enabled) {
      label = 'Turned off';
      tone = 'neutral';
    } else if (cap && used >= cap) {
      label = 'Daily limit reached';
      tone = 'warning';
    } else {
      label = 'Ready';
      tone = 'success';
    }
  }
  return (
    <section className="rr-aside-block" aria-labelledby="rr-ai-h">
      <h2 id="rr-ai-h" className="rr-aside-title">
        <Robot size={16} weight="bold" aria-hidden="true" /> AI status
      </h2>
      {!llm ? (
        <Skeleton width="60%" />
      ) : (
        <>
          <p className={`rr-ai-state rr-tone-${tone}`}>
            <span className="rr-ai-dot" aria-hidden="true" />
            {label}
          </p>
          {llm.model && (
            <p className="rr-field-help">
              Model: <span className="rr-mono">{llm.model}</span>
            </p>
          )}
          <div className="rr-usage">
            <div className="rr-usage-row">
              <span className="rr-subtle">Calls today</span>
              <span className="rr-num">
                <strong>{used}</strong> / {cap}
              </span>
            </div>
            <div
              className="rr-usage-bar"
              role="progressbar"
              aria-label="AI calls used today"
              aria-valuemin={0}
              aria-valuemax={cap}
              aria-valuenow={used}
            >
              <span style={{ width: `${ratio * 100}%` }} />
            </div>
          </div>
          {!llm.available && (
            <p className="rr-field-help">Matching and drafts use rules and templates instead. Nothing else changes.</p>
          )}
        </>
      )}
    </section>
  );
}

function Privacy() {
  return (
    <section className="rr-aside-block rr-privacy" aria-labelledby="rr-privacy-h">
      <h2 id="rr-privacy-h" className="rr-aside-title">
        <ShieldCheck size={16} weight="bold" aria-hidden="true" /> Your data
      </h2>
      <p>
        Everything stays in Atlassian. Results are stored in Forge SQL and AI runs on Forge LLM. No outside services.
      </p>
      <p>
        Recurrence Radar is decision support. It is not a validated QMS of record and makes no GxP or Part 11 claims.
      </p>
    </section>
  );
}
