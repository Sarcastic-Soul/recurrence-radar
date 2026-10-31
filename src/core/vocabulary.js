// Canonical vocabulary for pharma / medtech / general manufacturing quality.
// Each entry has a canonical `name` and a list of `patterns`. A pattern is
// either a plain phrase (matched case-insensitively on word boundaries) or a
// RegExp for trickier forms like "press #4".

// Builds patterns for numbered equipment, e.g. num('press', '4') matches
// "press 4", "press #4", "press no. 4", "press-4", "press4".
function num(word, n) {
  return new RegExp(`\\b${word}[\\s-]*(?:#|no\\.?\\s*|number\\s*)?${n}\\b`, 'i');
}

export const EQUIPMENT = [
  { name: 'Press 2', patterns: [num('press', '2'), num('tablet press', '2'), /\bp2 press\b/i] },
  { name: 'Press 4', patterns: [num('press', '4'), num('tablet press', '4'), /\bp4 press\b/i] },
  { name: 'Coater C3', patterns: [/\bcoater\s*(?:#\s*)?c?3\b/i, /\bc3 coater\b/i, /\bcoating pan (?:c)?3\b/i] },
  { name: 'Filler F1', patterns: [/\bfill(?:er|ing machine)\s*(?:#\s*)?f?1\b/i, /\bf1 filler\b/i] },
  { name: 'Blister B1', patterns: [/\bblister(?: machine| line| packer)?\s*(?:#\s*)?b?1\b/i, /\bb1 blister\b/i] },
  { name: 'Line 2 sealer', patterns: [/\bline\s*(?:#\s*)?2 seal(?:er|ing)\b/i, /\bsealer (?:on )?line\s*2\b/i, /\bl2 sealer\b/i] },
  { name: 'Granulator G1', patterns: [/\bgranulator\s*(?:#\s*)?g?1\b/i, /\bg1 granulator\b/i, /\bhigh[- ]shear granulator\b/i] },
  { name: 'Autoclave A2', patterns: [/\bautoclave\s*(?:#\s*)?a?2\b/i, /\ba2 autoclave\b/i, /\bsteam steriliser\b/i, /\bsteam sterilizer\b/i] },
  { name: 'Lyophilizer L1', patterns: [/\blyophili[sz]er\s*(?:#\s*)?l?1\b/i, /\bfreeze[- ]dryer\s*(?:#\s*)?(?:l?1)?\b/i, /\blyo\s*(?:#\s*)?1\b/i] },
  { name: 'Packaging Line 3', patterns: [/\bpackaging line\s*(?:#\s*)?3\b/i, /\bpack(?:ing)? line\s*3\b/i, /\bpl3\b/i] },
  { name: 'HPLC-07', patterns: [/\bhplc[\s-]*0?7\b/i] },
  { name: 'Mixer M2', patterns: [/\bmixer\s*(?:#\s*)?m?2\b/i, /\bm2 mixer\b/i, /\bblender\s*(?:#\s*)?2\b/i] },
  { name: 'Capper K1', patterns: [/\bcapper\s*(?:#\s*)?k?1\b/i, /\bcapping machine\s*1?\b/i] },
  { name: 'Labeler LB2', patterns: [/\blabel(?:l)?er\s*(?:#\s*)?(?:lb)?2\b/i, /\blabel(?:l)?ing machine\s*2\b/i] },
];

export const PRODUCTS = [
  { name: 'Metformin 500 mg tablets', patterns: [/\bmetformin\b/i] },
  { name: 'Amoxicillin 250 mg capsules', patterns: [/\bamoxicillin\b/i, /\bamox\b/i] },
  { name: 'Sterile saline 10 mL vials', patterns: [/\b(?:sterile )?saline\b/i, /\bnacl 0\.9\b/i] },
  { name: 'Insulin pen cartridges', patterns: [/\binsulin\b/i, /\bpen cartridges?\b/i] },
  { name: 'Ibuprofen 200 mg tablets', patterns: [/\bibuprofen\b/i] },
  { name: 'Atorvastatin 20 mg tablets', patterns: [/\batorvastatin\b/i] },
  { name: 'Paracetamol 500 mg tablets', patterns: [/\bparacetamol\b/i, /\bacetaminophen\b/i] },
  { name: 'Omeprazole 20 mg capsules', patterns: [/\bomeprazole\b/i] },
];

export const FAILURE_MODES = [
  { name: 'Weight variation', patterns: ['weight variation', 'weight out of spec', 'tablet weight', 'capsule weight', 'weight drift', 'underweight', 'overweight', /\bweight (?:deviation|excursion|failure|oos)\b/i, /\bweights? (?:high|low)\b/i] },
  { name: 'Seal integrity failure', patterns: ['seal integrity', 'seal failure', 'leak test', 'leaking', 'leaker', 'poor seal', 'weak seal', 'incomplete seal', 'seal defect', /\bseals? (?:failed|open|broken)\b/i] },
  { name: 'Particulate contamination', patterns: ['particulate', 'particles', 'foreign matter', 'visible particle', 'fibre', 'fiber', 'black specks', 'foreign particle'] },
  { name: 'Out-of-spec assay', patterns: ['assay out of spec', 'assay oos', 'low assay', 'high assay', 'potency out of spec', 'assay result', /\boos assay\b/i, /\bassay (?:failure|failed)\b/i] },
  { name: 'Temperature excursion', patterns: ['temperature excursion', 'temp excursion', 'cold chain', 'temperature out of range', 'overheating', 'temperature deviation', /\btemp(?:erature)? (?:high|low|alarm)\b/i] },
  { name: 'Label mix-up', patterns: ['label mix-up', 'label mixup', 'label mix up', 'wrong label', 'mislabel', 'mislabelled', 'mislabeled', 'incorrect label', 'label error'] },
  { name: 'Hardness out of spec', patterns: ['hardness out of spec', 'hardness', 'tablet hardness', 'too soft', 'too hard', 'friability'] },
  { name: 'Dissolution failure', patterns: ['dissolution failure', 'dissolution out of spec', 'dissolution', 'slow release', 'failed dissolution'] },
  { name: 'Fill volume deviation', patterns: ['fill volume', 'fill weight', 'underfill', 'underfilled', 'overfill', 'overfilled', 'short fill', 'low fill'] },
  { name: 'Documentation error', patterns: ['documentation error', 'batch record error', 'missing signature', 'missing entry', 'gdp error', 'record not completed', 'logbook not', 'incorrect entry'] },
  { name: 'Environmental monitoring excursion', patterns: ['environmental monitoring', 'em excursion', 'viable count', 'settle plate', 'air sample', 'action limit', 'alert limit', 'cleanroom excursion', 'grade a excursion'] },
  { name: 'Capping defect', patterns: ['capping defect', 'capping', 'loose cap', 'cap torque', 'crooked cap', 'missing cap', 'cap not seated', 'lamination'] },
];

export const ROOT_CAUSES = [
  { name: 'Tooling wear', patterns: ['tooling wear', 'worn tooling', 'worn punch', 'worn punches', 'punch wear', 'die wear', 'worn die', 'tooling damage', 'worn seal jaw', 'worn jaws'] },
  { name: 'Operator error', patterns: ['operator error', 'human error', 'operator mistake', 'wrong setting', 'incorrect setting', 'operator did not', 'operator failed'] },
  { name: 'Supplier material', patterns: ['supplier material', 'supplier issue', 'raw material', 'incoming material', 'vendor material', 'supplier lot', 'excipient lot', 'material from supplier', 'foil lot'] },
  { name: 'Calibration drift', patterns: ['calibration drift', 'out of calibration', 'calibration overdue', 'calibration expired', 'sensor drift', 'probe drift', 'balance drift', 'miscalibrated'] },
  { name: 'Procedure gap', patterns: ['procedure gap', 'sop gap', 'sop unclear', 'unclear procedure', 'procedure not', 'no procedure', 'sop does not', 'sop did not', 'inadequate procedure'] },
  { name: 'Equipment malfunction', patterns: ['equipment malfunction', 'equipment failure', 'machine fault', 'breakdown', 'mechanical failure', 'motor failure', 'sensor failure', 'malfunction'] },
  { name: 'Environmental control', patterns: ['environmental control', 'hvac', 'humidity', 'air handling', 'pressure differential', 'room temperature', 'dehumidifier'] },
  { name: 'Training gap', patterns: ['training gap', 'not trained', 'untrained', 'training not', 'insufficient training', 'lack of training', 'new operator'] },
];

// Common English words plus generic quality-system words that carry no signal.
export const STOPWORDS = new Set(`
a about above after again against all also am an and any are as at be because been before being below
between both but by can could did do does doing down during each few for from further had has have
having he her here hers him his how i if in into is it its itself just me more most my no nor not now
of off on once only or other our out over own same she should so some such than that the their them
then there these they this those through to too under until up very was we were what when where which
while who whom why will with would you your yet per via upon within without across among around
issue issues deviation deviations event observed noted found reported batch lot spec specs specification
result results during while time day shift found note notes please see attached etc approx approximately
was were check checked team area process production manufacturing quality qa qc dev capa sop
`.split(/\s+/).filter(Boolean));

// Tiny stemmer: strips plural "s"/"es", "ing" and "ed" so "punches" -> "punch",
// "sealing" -> "seal", "drifted" -> "drift". Not linguistically perfect, but
// consistent, which is what matters for keyword overlap.
export function stem(word) {
  let w = String(word).toLowerCase();
  if (w.length > 5 && w.endsWith('ing')) w = undouble(w.slice(0, -3));
  else if (w.length > 4 && w.endsWith('ed')) w = undouble(w.slice(0, -2));
  else if (w.length > 4 && /(?:ch|sh|x|ss)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1);
  return w;
}

// "capp" -> "cap", "stopp" -> "stop" (but keep "seal", "fill", "pass").
function undouble(w) {
  return /([b-df-hj-km-np-tv-z])\1$/.test(w) && !/(?:ll|ss|zz|ff)$/.test(w) ? w.slice(0, -1) : w;
}

// Turns a phrase into a word-bounded, case-insensitive RegExp.
function toRegex(p) {
  if (p instanceof RegExp) return p;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

// Pre-compile every list once so matching is cheap.
function compile(list) {
  return list.map((e) => ({ name: e.name, regexes: e.patterns.map(toRegex) }));
}

export const COMPILED = {
  equipment: compile(EQUIPMENT),
  product: compile(PRODUCTS),
  failureMode: compile(FAILURE_MODES),
  rootCause: compile(ROOT_CAUSES),
};

// Finds the best vocab entry in `text`. "Best" = longest matched text, then
// earliest position. Returns the canonical name or null.
export function matchVocab(category, text) {
  const list = COMPILED[category];
  if (!list || !text) return null;
  let best = null;
  for (const entry of list) {
    for (const re of entry.regexes) {
      const m = re.exec(text);
      if (!m) continue;
      const len = m[0].length;
      if (!best || len > best.len || (len === best.len && m.index < best.index)) {
        best = { name: entry.name, len, index: m.index };
      }
    }
  }
  return best ? best.name : null;
}

// Canonical names per category (used in the LLM prompt and to map LLM output).
export const NAMES = {
  equipment: EQUIPMENT.map((e) => e.name),
  product: PRODUCTS.map((e) => e.name),
  failureMode: FAILURE_MODES.map((e) => e.name),
  rootCause: ROOT_CAUSES.map((e) => e.name),
};
