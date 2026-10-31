/**
 * App settings, stored as one JSON value in Forge SQL.
 * Defaults are chosen so a judge never has to open the settings page.
 */
import { getSettingValue, setSettingValue } from '../db/queries';

export const DEFAULT_SETTINGS = {
  watchedProjectKeys: [], // the demo loader adds its project automatically
  capaLabel: 'capa',
  sopLabel: 'sop',
  llmEnabled: true,
  llmDailyCap: 200,
  matchThreshold: 0.45,
};

export async function getSettings() {
  const saved = (await getSettingValue('settings')) || {};
  return { ...DEFAULT_SETTINGS, ...saved };
}

/** Validate and save. Unknown keys are dropped, numbers are clamped. */
export async function saveSettings(input = {}) {
  const current = await getSettings();
  const next = { ...current };
  if (Array.isArray(input.watchedProjectKeys)) {
    next.watchedProjectKeys = [...new Set(input.watchedProjectKeys.map((k) => String(k).trim().toUpperCase()).filter(Boolean))];
  }
  if (typeof input.capaLabel === 'string') next.capaLabel = cleanLabel(input.capaLabel) || DEFAULT_SETTINGS.capaLabel;
  if (typeof input.sopLabel === 'string') next.sopLabel = cleanLabel(input.sopLabel) || DEFAULT_SETTINGS.sopLabel;
  if (typeof input.llmEnabled === 'boolean') next.llmEnabled = input.llmEnabled;
  if (input.llmDailyCap !== undefined) next.llmDailyCap = clamp(Math.round(Number(input.llmDailyCap)), 0, 2000, 200);
  if (input.matchThreshold !== undefined) next.matchThreshold = clamp(Number(input.matchThreshold), 0.3, 0.8, 0.45);
  await setSettingValue('settings', next);
  return next;
}

export async function addWatchedProject(projectKey) {
  const s = await getSettings();
  if (!s.watchedProjectKeys.includes(projectKey)) {
    await saveSettings({ watchedProjectKeys: [...s.watchedProjectKeys, projectKey] });
  }
}

function cleanLabel(v) {
  return v.trim().toLowerCase().replace(/\s+/g, '-');
}

function clamp(n, min, max, fallback) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// ---------- demo status (separate key so settings saves never clobber it) ----------

export async function getDemoState() {
  return (await getSettingValue('demo')) || { state: 'none' };
}

export async function setDemoState(state) {
  await setSettingValue('demo', state);
}
