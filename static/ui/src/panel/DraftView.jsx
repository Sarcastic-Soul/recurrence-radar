import { useEffect, useRef, useState } from 'react';
import { Copy, ChatText, X, PencilSimple, Eye, Check } from '@phosphor-icons/react';
import { api, errorMessage, flag } from '../shared/api.js';
import { Button, Skeleton } from '../shared/components.jsx';

// Inline draft view (the panel iframe auto-sizes, so an inline section
// behaves better than a fixed overlay). Draft can take ~15 s with the LLM.
export default function DraftView({ onClose }) {
  const [phase, setPhase] = useState('drafting'); // drafting | ready | error
  const [text, setText] = useState('');
  const [method, setMethod] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const headingRef = useRef(null);

  const load = async () => {
    setPhase('drafting');
    setElapsed(0);
    try {
      const res = await api.draftInvestigation();
      setText(res?.text || '');
      setMethod(res?.method || null);
      setPhase('ready');
    } catch (err) {
      setError(errorMessage(err));
      setPhase('error');
    }
  };

  useEffect(() => {
    headingRef.current?.focus();
    load();
  }, []);

  useEffect(() => {
    if (phase !== 'drafting') return undefined;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const post = async () => {
    setPosting(true);
    try {
      const res = await api.postDraft(text);
      if (res?.ok === false) throw new Error(res.message || 'Jira did not accept the comment.');
      setPosted(true);
      flag({
        title: 'Draft posted as a comment',
        description: 'You can edit it in the issue activity.',
        type: 'success',
      });
    } catch (err) {
      flag({ title: 'Could not post the comment', description: errorMessage(err), type: 'error' });
    } finally {
      setPosting(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toPlain(text));
    } catch {
      // Clipboard API can be blocked in iframes; fall back to a hidden textarea.
      const ta = document.createElement('textarea');
      ta.value = toPlain(text);
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rr-draft" aria-labelledby="rr-draft-h">
      <header className="rr-draft-head">
        <h2 id="rr-draft-h" className="rr-draft-title" tabIndex={-1} ref={headingRef}>
          Investigation draft
        </h2>
        {method && (
          <span className="rr-subtlest rr-draft-method">{method === 'llm' ? 'Written with AI' : 'From template'}</span>
        )}
        <button type="button" className="rr-icon-btn" onClick={onClose} aria-label="Close draft">
          <X size={16} weight="bold" aria-hidden="true" />
        </button>
      </header>

      {phase === 'drafting' && (
        <div className="rr-draft-body" role="status" aria-live="polite">
          <p className="rr-status">
            Drafting… <span className="rr-num rr-subtlest">{elapsed}s</span>
            <span className="rr-subtlest">· usually 10 to 20 seconds</span>
          </p>
          <div className="rr-draft-skel">
            <Skeleton width="30%" height={12} />
            <Skeleton width="95%" />
            <Skeleton width="88%" />
            <Skeleton width="30%" height={12} style={{ marginTop: 8 }} />
            <Skeleton width="80%" />
            <Skeleton width="72%" />
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="rr-draft-body">
          <p className="rr-inline-error" role="alert">
            Could not write the draft: {error}
          </p>
          <div className="rr-draft-actions">
            <Button onClick={load}>Try again</Button>
          </div>
        </div>
      )}

      {phase === 'ready' && (
        <>
          <div className="rr-draft-body">
            {editing ? (
              <textarea
                className="rr-draft-edit"
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label="Edit draft text"
                rows={16}
              />
            ) : (
              <DraftText text={text} />
            )}
          </div>
          <div className="rr-draft-actions">
            <Button
              variant="primary"
              icon={posted ? Check : ChatText}
              onClick={post}
              loading={posting}
              disabled={posted || !text.trim()}
            >
              {posted ? 'Posted' : posting ? 'Posting…' : 'Post as comment'}
            </Button>
            <Button icon={copied ? Check : Copy} onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="subtle"
              icon={editing ? Eye : PencilSimple}
              onClick={() => setEditing((v) => !v)}
              disabled={posted}
            >
              {editing ? 'Preview' : 'Edit'}
            </Button>
          </div>
          <p className="rr-draft-note">Check the draft before posting. It cites past tickets but may be wrong.</p>
        </>
      )}
    </section>
  );
}

// Renders "## Heading" and "- bullet" lines; everything else is a paragraph.
function DraftText({ text }) {
  const blocks = [];
  let list = null;
  text.split('\n').forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^\s*[-*] /.test(line)) {
      if (!list) {
        list = [];
        blocks.push({ type: 'ul', items: list, key: i });
      }
      list.push(line.replace(/^\s*[-*] /, ''));
      return;
    }
    list = null;
    if (!line.trim()) return;
    if (line.startsWith('## ') || line.startsWith('# '))
      blocks.push({ type: 'h', text: line.replace(/^#+ /, ''), key: i });
    else blocks.push({ type: 'p', text: line, key: i });
  });
  return (
    <div className="rr-draft-text">
      {blocks.map((b) => {
        if (b.type === 'h') return <h3 key={b.key}>{b.text}</h3>;
        if (b.type === 'ul') {
          return (
            <ul key={b.key}>
              {b.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          );
        }
        return <p key={b.key}>{b.text}</p>;
      })}
    </div>
  );
}

// Plain text for the clipboard: drop the "## " markers, keep bullets.
function toPlain(text) {
  return text
    .split('\n')
    .map((l) => l.replace(/^#+ /, ''))
    .join('\n');
}
