import { absorptionAnalysis, evolveDistribution, firstArrivalByHorizon, hittingAnalysis, pathProbability } from '../markov/analysis';
import { compileChain, initialVector, rowOf } from '../markov/compile';
import { createEmptyDocument } from '../markov/document';
import { compensatedSum, EPS_ROW, formatProbability, formatTotal } from '../markov/numeric';
import type { ChainDocumentV1, StateId } from '../markov/types';
import type { AssessmentResult, Assertion, AssertionResult, ChallengeDefinition, ModelMetric, ModelSnapshot, NumericTarget, Submission } from './types';

export function snapshotToDocument(s: ModelSnapshot): ChainDocumentV1 {
  const base = createEmptyDocument(s.title);
  const ids = s.states.map((st) => st.id);
  return {
    ...base,
    stateOrder: ids,
    states: s.states.map(({ id, label }) => ({ id, label })),
    transitions: s.P.flatMap((row, i) => row.flatMap((p, j) => (p !== 0 ? [{ from: ids[i], to: ids[j], probability: p }] : []))),
    initial: ids.map((id, i) => ({ stateId: id, probability: s.mu0[i] ?? 0 })),
    layout: { positions: Object.fromEntries(s.states.map((st) => [st.id, { x: st.x, y: st.y }])) },
    metadata: { ...base.metadata, stepLabel: s.stepLabel },
  };
}

export function documentToSnapshot(d: ChainDocumentV1): ModelSnapshot {
  return {
    title: d.title,
    states: d.stateOrder.map((id) => ({ id, label: d.states.find((s) => s.id === id)?.label ?? id, ...(d.layout.positions[id] ?? { x: 0, y: 0 }) })),
    P: d.stateOrder.map((id) => rowOf(d, id)),
    mu0: initialVector(d),
    stepLabel: d.metadata.stepLabel,
  };
}

/** Exact value of a numeric target on a snapshot (null if the model is invalid). */
export function evaluateTarget(snapshot: ModelSnapshot, target: NumericTarget): number | null {
  const c = compileChain(snapshotToDocument(snapshot));
  if (c.status !== 'ok') return null;
  if (target.type === 'path') {
    const r = pathProbability(c.result, target.path, target.mode);
    return r.status === 'ok' ? r.result.probability : null;
  }
  const e = evolveDistribution(c.result, target.t);
  const i = c.result.stateIds.indexOf(target.state);
  return e.status === 'ok' && i >= 0 ? e.result[target.t][i] : null;
}

/** Exact value of a comparison metric from μ₀; Infinity is returned only for a genuinely infinite expectation. */
export function evaluateMetric(snapshot: ModelSnapshot, m: ModelMetric): number | null {
  const c = compileChain(snapshotToDocument(snapshot));
  if (c.status !== 'ok') return null;
  const chain = c.result;
  if (m.type === 'hit-by') return firstArrivalByHorizon(chain, m.targets, m.horizon)[m.horizon];
  if (m.type === 'mean-hit') {
    const h = hittingAnalysis(chain, m.targets);
    if (h.status !== 'ok') return null;
    let sum = 0;
    for (let i = 0; i < chain.initial.length; i++) {
      if (chain.initial[i] === 0) continue;
      const t = h.result.meanTime[i];
      if (t.kind !== 'finite') return Infinity;
      sum += chain.initial[i] * t.value;
    }
    return sum;
  }
  const ab = absorptionAnalysis(chain);
  const a = chain.stateIds.indexOf(m.state);
  if (ab.status !== 'ok' || a < 0) return null;
  const col = ab.result.absorbing.indexOf(a);
  if (col < 0) return 0;
  return compensatedSum(chain.initial.map((p, i) => {
    if (i === a) return p;
    const k = ab.result.transient.indexOf(i);
    return k < 0 ? 0 : p * ab.result.B[k][col];
  }));
}

const fmtMetric = (m: ModelMetric, v: number) => (!Number.isFinite(v) ? 'infinite' : m.type === 'mean-hit' ? `${v.toFixed(3)} ${m.unit}` : formatProbability(v, 4));

/** Parse a learner's numeric answer: decimal, scientific, a simple fraction a/b, or a percentage. Never evaluated as code. */
export function parseAnswer(text: string): number | null {
  const t = text.trim().replace(',', '.');
  let m = /^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*%$/.exec(t);
  if (m) return Number(m[1]) / 100;
  m = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (m) return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
  return /^[+-]?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(t) ? Number(t) : null;
}

function check(def: ChallengeDefinition, a: Assertion, sub: Submission): AssertionResult & { why: string } {
  const s = sub.snapshot;
  const ids = s.states.map((x) => x.id);
  const label = (id: StateId) => s.states.find((x) => x.id === id)?.label || 'Unnamed';
  const role = (r: string) => sub.roleMap[r] ?? r;
  /** Role name if the challenge uses roles, otherwise the state's label. */
  const nameOf = (r: string) => (sub.roleMap[r] ? r : ids.includes(r) ? label(r) : r);
  switch (a.kind) {
    case 'rows-valid': {
      const bad = s.P.map((row, i) => ({ i, sum: compensatedSum(row), neg: row.some((p) => p < 0 || p > 1) }))
        .filter((r) => r.neg || Math.abs(r.sum - 1) > EPS_ROW);
      return bad.length
        ? { passed: false, message: `Rows that need repair: ${bad.map((b) => `${label(ids[b.i])} (total ${formatTotal(b.sum)}${b.neg ? ', has a value outside 0–1' : ''})`).join('; ')}.`, why: 'Each step the chain must move somewhere, so every row of probabilities must total exactly 1.' }
        : { passed: true, message: 'Every row totals exactly 1.', why: '' };
    }
    case 'initial-valid': {
      const sum = compensatedSum(s.mu0);
      const ok = s.mu0.every((p) => p >= 0 && p <= 1) && Math.abs(sum - 1) <= EPS_ROW;
      return ok ? { passed: true, message: 'The starting distribution totals 1.', why: '' }
        : { passed: false, message: `The starting distribution totals ${formatTotal(sum)}.`, why: 'At step 0 the chain is certainly in some state, so μ₀ must total 1.' };
    }
    case 'state-count':
      return s.states.length === a.equals ? { passed: true, message: `The model has ${a.equals} states.`, why: '' }
        : { passed: false, message: `The model has ${s.states.length} states; the scenario needs ${a.equals}.`, why: 'Each distinct situation in the scenario is one state — no more, no fewer.' };
    case 'transition': {
      const from = role(a.from); const to = role(a.to);
      const i = ids.indexOf(from); const j = ids.indexOf(to);
      if (i < 0 || j < 0) return { passed: false, message: `Map the roles “${a.from}” and “${a.to}” to states in your model.`, why: 'Grading compares meanings, not names or positions, so each role must point at one of your states.' };
      const v = s.P[i][j];
      return Math.abs(v - a.value) <= a.tolerance
        ? { passed: true, message: `P(${nameOf(a.from)} → ${nameOf(a.to)}) = ${formatProbability(v)} matches the scenario.`, why: '' }
        : { passed: false, message: `P(${nameOf(a.from)} → ${nameOf(a.to)}) is ${formatProbability(v)}.`, why: `Re-read the scenario: this is the probability of being ${nameOf(a.to)} next given ${nameOf(a.from)} now — it belongs in the ${nameOf(a.from)} row (From), ${nameOf(a.to)} column (To).` };
    }
    case 'transition-positive': {
      const i = ids.indexOf(role(a.from)); const j = ids.indexOf(role(a.to));
      const ok = i >= 0 && j >= 0 && s.P[i][j] > 0;
      return ok ? { passed: true, message: `${label(ids[i])} → ${label(ids[j])} is still possible.`, why: '' }
        : { passed: false, message: `The transition ${nameOf(a.from)} → ${nameOf(a.to)} was removed.`, why: a.why };
    }
    case 'rows-locked': {
      const starterIds = def.starter.states.map((x) => x.id);
      const changed = (def.lockedRows ?? []).filter((id) => {
        const i = ids.indexOf(id);
        const k = starterIds.indexOf(id);
        if (i < 0 || k < 0 || ids.length !== starterIds.length) return true;
        return starterIds.some((to, j) => s.P[i][ids.indexOf(to)] !== def.starter.P[k][j]);
      });
      return changed.length
        ? { passed: false, message: `Rows that must stay as given were changed: ${changed.map(label).join(', ')}.`, why: 'A controlled comparison changes only what the scenario allows, so any difference in the result can be traced to that edit.' }
        : { passed: true, message: 'Only the permitted rows were changed.', why: '' };
    }
    case 'transition-range': {
      const i = ids.indexOf(role(a.from)); const j = ids.indexOf(role(a.to));
      const v = i >= 0 && j >= 0 ? s.P[i][j] : NaN;
      const ok = v >= a.min - 1e-12 && v <= a.max + 1e-12;
      const range = a.min === a.max ? formatProbability(a.min) : `${formatProbability(a.min)}–${formatProbability(a.max)}`;
      return ok ? { passed: true, message: `P(${nameOf(a.from)} → ${nameOf(a.to)}) = ${formatProbability(v)} respects the constraint (${range}).`, why: '' }
        : { passed: false, message: `P(${nameOf(a.from)} → ${nameOf(a.to)}) is ${Number.isNaN(v) ? 'missing' : formatProbability(v)}; it must be ${range}.`, why: a.why };
    }
    case 'metric': {
      const base = evaluateMetric(def.starter, a.metric);
      const mine = evaluateMetric(s, a.metric);
      if (mine === null) return { passed: false, message: `${a.metric.label}: fix the model's validation issues first.`, why: 'Exact results need a valid model.' };
      const ok = a.op === 'at-most' ? mine <= a.value : mine >= a.value;
      const goal = `${a.op === 'at-most' ? 'at most' : 'at least'} ${fmtMetric(a.metric, a.value)}`;
      let delta = '';
      if (base !== null && Number.isFinite(base) && Number.isFinite(mine)) {
        const d = mine - base;
        delta = d === 0 ? ' (same as the baseline)' : a.metric.type === 'mean-hit'
          ? ` (${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(3)} ${a.metric.unit} vs the baseline ${fmtMetric(a.metric, base)}${base !== 0 ? `, ${d >= 0 ? '+' : '−'}${Math.abs((d / Math.abs(base)) * 100).toFixed(1)}%` : ''})`
          : ` (${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(2)} percentage points vs the baseline ${fmtMetric(a.metric, base)})`;
      }
      return ok
        ? { passed: true, message: `${a.metric.label} is ${fmtMetric(a.metric, mine)} — goal ${goal} met${delta}.`, why: '' }
        : { passed: false, message: `${a.metric.label} is ${fmtMetric(a.metric, mine)}; the goal is ${goal}${delta}.`, why: a.why };
    }
    case 'numeric-answer': {
      const exact = evaluateTarget(def.starter, a.target);
      const given = parseAnswer(sub.answers[a.key] ?? '');
      if (exact === null) return { passed: false, message: 'This question’s model is invalid.', why: 'Contact your instructor.' };
      if (given === null) return { passed: false, message: `${a.label}: enter a number (e.g. 0.12, 12%, or 3/25).`, why: 'Answers are checked numerically.' };
      return Math.abs(given - exact) <= a.tolerance
        ? { passed: true, message: `${a.label}: ${formatProbability(given, 6)} is correct.`, why: '' }
        : { passed: false, message: `${a.label}: ${formatProbability(given, 6)} is not correct.`, why: a.target.type === 'path'
          ? (a.target.mode === 'joint' ? 'A joint path probability multiplies the starting probability μ₀(first state) by one transition probability per step.' : 'Given the starting state, multiply one transition probability for each step — do not include μ₀.')
          : 'μₜ(j) adds up the probabilities of every path that ends in j at step t, not just one path.' };
    }
  }
}

/** Deterministic grading from exact model calculations (no randomness, no canvas coordinates). */
export function assessChallenge(def: ChallengeDefinition, sub: Submission): AssessmentResult {
  const checked = def.assertions.map((a) => check(def, a, sub));
  const passed = checked.every((r) => r.passed);
  return {
    challengeId: def.id,
    version: def.version,
    passed,
    correct: checked.filter((r) => r.passed).map((r) => r.message),
    needsAttention: checked.filter((r) => !r.passed).map((r) => ({ message: r.message, why: r.why })),
    next: passed ? def.nextConcept : 'Use the next hint if you are stuck — hints never cost you the challenge.',
    results: checked.map(({ passed: p, message }) => ({ passed: p, message })),
  };
}

/** Best-effort role suggestion by matching labels (case-insensitive); learner can override. */
export function suggestRoles(roles: string[], s: ModelSnapshot): Record<string, StateId> {
  const map: Record<string, StateId> = {};
  for (const r of roles) {
    const hit = s.states.find((st) => st.label.trim().toLowerCase() === r.toLowerCase())
      ?? s.states.find((st) => st.label.toLowerCase().includes(r.toLowerCase()));
    if (hit) map[r] = hit.id;
  }
  return map;
}
