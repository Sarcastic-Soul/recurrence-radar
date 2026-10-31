// Field extraction from free text: a rules-based extractor (dictionary match)
// and helpers for the optional LLM path (prompt + safe parsing).
import { STOPWORDS, stem, matchVocab, NAMES } from './vocabulary.js';

const MAX_KEYWORDS = 12;

// Lowercase meaningful keywords: no stopwords, no numbers, no batch-like
// tokens (anything containing a digit, e.g. "b2291", "500mg"), stemmed, deduped.
export function extractKeywords(text, max = MAX_KEYWORDS) {
  const out = [];
  const seen = new Set();
  for (const raw of String(text || '').toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || /\d/.test(raw) || STOPWORDS.has(raw)) continue;
    const s = stem(raw);
    if (s.length < 3 || STOPWORDS.has(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

// Rules-only extraction using the vocabulary. Missing fields are null.
export function extractRules(text) {
  const t = String(text || '');
  return {
    equipment: matchVocab('equipment', t),
    product: matchVocab('product', t),
    failureMode: matchVocab('failureMode', t),
    rootCause: matchVocab('rootCause', t),
    keywords: extractKeywords(t),
  };
}

// Prompt for the LLM extractor. Asks for strict JSON using canonical names.
export function buildExtractionPrompt(text) {
  const system = [
    'You extract structured fields from manufacturing quality records (deviations, CAPAs) in pharma, medtech and general manufacturing.',
    'Return ONLY a JSON object, no prose, no code fences, with exactly these keys:',
    '{"equipment": string|null, "product": string|null, "failureMode": string|null, "rootCause": string|null, "keywords": string[]}',
    'For each field, choose the closest canonical name from the lists below. If nothing fits, use null. Never guess a root cause that the text does not support.',
    `equipment: ${NAMES.equipment.join('; ')}`,
    `product: ${NAMES.product.join('; ')}`,
    `failureMode: ${NAMES.failureMode.join('; ')}`,
    `rootCause: ${NAMES.rootCause.join('; ')}`,
    'keywords: up to 10 lowercase single words that describe the problem (no batch numbers, no stopwords).',
  ].join('\n');
  const user = `Record text:\n"""\n${String(text || '').slice(0, 4000)}\n"""`;
  return { system, user };
}

// Maps a raw value to a canonical vocab name. Unknown values are kept only if
// short and non-empty; otherwise null.
function canonical(category, value) {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v || /^(null|none|n\/a|unknown)$/i.test(v)) return null;
  const exact = NAMES[category].find((n) => n.toLowerCase() === v.toLowerCase());
  if (exact) return exact;
  const viaSynonym = matchVocab(category, v);
  if (viaSynonym) return viaSynonym;
  return v.length < 60 ? v : null;
}

// Pulls the first {...} block out of LLM text (handles ``` fences and chatter).
function findJson(text) {
  const s = String(text || '').replace(/```(?:json)?/gi, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return JSON.parse(s.slice(start, end + 1));
}

// Parses LLM output into extracted fields. Any failure falls back to rules.
// When the LLM leaves a field null but the rules find it, the rules value is
// used, so the LLM path never does worse than the rules path.
export function parseExtraction(llmText, fallbackText) {
  const rules = extractRules(fallbackText);
  let obj;
  try {
    obj = findJson(llmText);
  } catch {
    return rules;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return rules;

  const out = {};
  for (const key of ['equipment', 'product', 'failureMode', 'rootCause']) {
    out[key] = canonical(key, obj[key]) ?? rules[key];
  }
  const llmWords = Array.isArray(obj.keywords) ? obj.keywords : [];
  const merged = [];
  for (const w of [...llmWords.flatMap((k) => extractKeywords(String(k))), ...rules.keywords]) {
    if (!merged.includes(w)) merged.push(w);
  }
  out.keywords = merged.slice(0, MAX_KEYWORDS);
  return out;
}

// Deterministic FNV-1a 64-bit hash as 16 hex chars (used as an LLM cache key).
export function textHash(text) {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  const bytes = new TextEncoder().encode(String(text ?? ''));
  for (const b of bytes) {
    h ^= BigInt(b);
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, '0');
}
