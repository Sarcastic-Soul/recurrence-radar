/**
 * Forge LLM wrapper.
 *
 * - Picks an available Claude model at runtime (prefers a small, fast one).
 * - Enforces the per-site daily call cap from settings (a free app means
 *   the developer pays for usage).
 * - Never throws for "LLM not available": callers get `null` and fall back
 *   to the rule-based path.
 */
import { chat, list } from '@forge/llm';
import { getLlmCallsToday, incrementLlmCalls } from '../db/queries';

let cachedModel;

export async function pickModel() {
  if (cachedModel !== undefined) return cachedModel;
  try {
    const { models = [] } = await list();
    const active = models.filter((m) => m.status === 'active').map((m) => m.model);
    const prefer = ['haiku', 'sonnet'];
    cachedModel = null;
    for (const word of prefer) {
      const hit = active.find((m) => m.includes(word));
      if (hit) {
        cachedModel = hit;
        break;
      }
    }
    if (!cachedModel) cachedModel = active[0] || null;
  } catch (err) {
    console.warn('Forge LLM list() failed, treating LLM as unavailable', err.message);
    cachedModel = null;
  }
  return cachedModel;
}

export async function llmStatus(settings) {
  const model = await pickModel();
  const callsToday = await getLlmCallsToday().catch(() => 0);
  return {
    available: Boolean(model),
    enabled: Boolean(settings.llmEnabled),
    model,
    callsToday,
    cap: settings.llmDailyCap,
  };
}

/** True when an LLM call is allowed right now. */
export async function canUseLlm(settings) {
  if (!settings.llmEnabled || settings.llmDailyCap <= 0) return false;
  const model = await pickModel();
  if (!model) return false;
  const calls = await getLlmCallsToday().catch(() => 0);
  return calls < settings.llmDailyCap;
}

/**
 * Send one system + user prompt. Returns the reply text, or null on any failure.
 */
export async function complete({ system, user }, { maxTokens = 600, temperature = 0.2 } = {}) {
  const model = await pickModel();
  if (!model) return null;
  try {
    await incrementLlmCalls();
    const response = await chat({
      model,
      messages: [
        { role: 'system', content: [{ type: 'text', text: system }] },
        { role: 'user', content: [{ type: 'text', text: user }] },
      ],
      temperature,
      max_completion_tokens: maxTokens,
    });
    const content = response?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.map((c) => c.text || '').join('');
    return null;
  } catch (err) {
    console.warn('Forge LLM chat failed, falling back', err.message);
    return null;
  }
}
