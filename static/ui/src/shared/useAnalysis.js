import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage, onIssueChanged } from './api.js';

const POLL_MS = 2000;
const POLL_LIMIT_MS = 40000;

// Shared by the issue panel and the glance.
// phase: 'loading' | 'ready' | 'pending' | 'timeout' | 'not_tracked' | 'error'
export function useAnalysis() {
  const [state, setState] = useState({ phase: 'loading', analysis: null, llm: null, reason: null, message: null });
  const pollStart = useRef(0);
  const timer = useRef(null);
  const alive = useRef(true);

  const stopPolling = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };

  const apply = useCallback((res) => {
    if (!alive.current) return;
    const status = res?.status || 'error';
    if (status === 'pending') {
      if (!pollStart.current) pollStart.current = Date.now();
      const elapsed = Date.now() - pollStart.current;
      if (elapsed >= POLL_LIMIT_MS) {
        pollStart.current = 0;
        setState((s) => ({ ...s, phase: 'timeout', analysis: res.analysis || s.analysis, llm: res.llm || s.llm }));
        return;
      }
      setState((s) => ({ ...s, phase: 'pending', analysis: res.analysis || s.analysis, llm: res.llm || s.llm }));
      stopPolling();
      // eslint-disable-next-line no-use-before-define
      timer.current = setTimeout(() => fetchNow(), POLL_MS);
      return;
    }
    pollStart.current = 0;
    stopPolling();
    if (status === 'ready') {
      setState({ phase: 'ready', analysis: res.analysis, llm: res.llm, reason: null, message: null });
    } else if (status === 'not_tracked') {
      setState({ phase: 'not_tracked', analysis: null, llm: res.llm, reason: res.reason || 'project', message: null });
    } else {
      setState((s) => ({ ...s, phase: 'error', message: res?.message || 'The check could not finish.' }));
    }
  }, []);

  const fetchNow = useCallback(async () => {
    try {
      apply(await api.getAnalysis());
    } catch (err) {
      if (!alive.current) return;
      stopPolling();
      pollStart.current = 0;
      setState((s) => ({ ...s, phase: 'error', message: errorMessage(err) }));
    }
  }, [apply]);

  const rerun = useCallback(async () => {
    stopPolling();
    pollStart.current = Date.now();
    setState((s) => ({ ...s, phase: 'pending' }));
    try {
      apply(await api.runAnalysis());
    } catch (err) {
      pollStart.current = 0;
      setState((s) => ({ ...s, phase: 'error', message: errorMessage(err) }));
    }
  }, [apply]);

  useEffect(() => {
    alive.current = true;
    fetchNow();
    let unsubscribe = () => {};
    onIssueChanged(() => {
      // The backend re-checks after an edit; start a fresh poll window.
      pollStart.current = 0;
      fetchNow();
    }).then((fn) => {
      unsubscribe = fn;
    });
    return () => {
      alive.current = false;
      stopPolling();
      unsubscribe();
    };
  }, [fetchNow]);

  return { ...state, refresh: fetchNow, rerun };
}
