import { absorptionAnalysis, evolveDistribution, firstArrivalByHorizon, hittingAnalysis, pathProbability, stationaryDistributions } from '../markov/analysis';
import { classifyChain } from '../markov/structure';
import { compileChain, initialVector, rowOf } from '../markov/compile';
import { createEmptyDocument } from '../markov/document';
import { compensatedSum, EPS_ROW, formatProbability, formatTotal } from '../markov/numeric';
import type { ChainDocumentV1, StateId } from '../markov/types';
import type { AssessmentResult, Assertion, AssertionResult, ChallengeDefinition, ModelMetric, ModelSnapshot, NumericTarget, StateSetTarget, Submission } from './types';

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

/** Exact value of a numeric target on a snapshot (null if the model is invalid or the quantity is undefined). */
export function evaluateTarget(snapshot: ModelSnapshot, target: NumericTarget): number | null {
  const c = compileChain(snapshotToDocument(snapshot));
  if (c.status !== 'ok') return null;
  const chain = c.result;
  const idx = (id: StateId) => chain.stateIds.indexOf(id);
  switch (target.type) {
    case 'path': {
      const r = pathProbability(chain, target.path, target.mode);
      return r.status === 'ok' ? r.result.probability : null;
    }
    case 'distribution': {
      const e = evolveDistribution(chain, target.t);
      const i = idx(target.state);
      return e.status === 'ok' && i >= 0 ? e.result[target.t][i] : null;
    }
    case 'stationary': {
      const st = stationaryDistributions(chain);
      const i = idx(target.state);
      return st.status === 'ok' && st.result.unique && i >= 0 ? st.result.extremal[0].pi[i] : null;
    }
    case 'absorb':
    case 'expected-steps': {
      const ab = absorptionAnalysis(chain);
      if (ab.status !== 'ok') return null;
      const k = ab.result.transient.indexOf(idx(target.from));
      if (target.type === 'expected-steps') return k < 0 ? 0 : ab.result.t[k];
      const col = ab.result.absorbing.indexOf(idx(target.into));
      if (col < 0) return null;
      return k < 0 ? (target.from === target.into ? 1 : 0) : ab.result.B[k][col];
    }
    case 'hit-by':
      return firstArrivalByHorizon(chain, target.targets, target.t)[target.t];
  }
}

/** Exact structural set (state IDs) used by state-set questions. */
export function evaluateStateSet(snapshot: ModelSnapshot, target: StateSetTarget): StateId[] | null {
  const c = compileChain(snapshotToDocument(snapshot));
  if (c.status !== 'ok') return null;
  const st = classifyChain(c.result);
  if (st.status !== 'ok') return null;
  const s = st.result;
  const idx = target === 'absorbing' ? s.absorbing
    : target === 'transient' ? s.transient
    : s.classes.filter((k) => k.closed).flatMap((k) => k.states);
  return c.result.stateIds.filter((_, i) => idx.includes(i));
}

/**
 * Values a learner typically produces through a specific misconception, with an explanation.
 * Used only to explain a wrong answer — never to award credit.
 */
export function diagnoseNumeric(snapshot: ModelSnapshot, target: NumericTarget): { value: number; why: string }[] {
  const out: { value: number; why: string }[] = [];
  const add = (v: number | null, why: string) => { if (v !== null && Number.isFinite(v)) out.push({ value: v, why }); };
  const transposed: ModelSnapshot = { ...snapshot, P: snapshot.P.map((_, i) => snapshot.P.map((row) => row[i])) };
  const pi = (id: StateId) => snapshot.states.findIndex((x) => x.id === id);
  switch (target.type) {
    case 'path':
      add(evaluateTarget(snapshot, { ...target, mode: target.mode === 'joint' ? 'conditional' : 'joint' }),
        target.mode === 'joint' ? 'This is the probability given the start. The joint probability also multiplies by μ₀ of the first state.' : 'This includes μ₀ of the first state. Given the start, multiply the transitions only.');
      break;
    case 'distribution': {
      if (target.t >= 2) {
        // The single most likely path into the state: a common “one path is the answer” slip.
        const e = evaluateTarget(snapshot, target);
        let best = 0;
        const start = snapshot.mu0.findIndex((p) => p === 1);
        if (start >= 0 && target.t === 2) {
          const j = pi(target.state);
          for (let k = 0; k < snapshot.P.length; k++) best = Math.max(best, snapshot.P[start][k] * snapshot.P[k][j]);
          if (e !== null && best !== e) add(best, 'That is the probability of one path. μₜ(j) adds every path that ends in j at step t.');
        }
      }
      add(evaluateTarget(transposed, target), 'That reads the matrix by columns. Probabilities out of a state are in its row (From → To).');
      break;
    }
    case 'absorb': {
      const i = pi(target.from); const j = pi(target.into);
      if (i >= 0 && j >= 0) add(snapshot.P[i][j], 'That is only the one-step probability. Paths that wander through other transient states first also end there — solve (I − Q)B = R.');
      break;
    }
    case 'expected-steps': {
      const i = pi(target.from);
      if (i >= 0) add(1 / (1 - snapshot.P[i][i]), 'That is the expected time to leave the starting state, not to be absorbed. Count the visits to every transient state: t = (I − Q)⁻¹1.');
      break;
    }
    case 'hit-by': {
      const e = evaluateTarget(snapshot, { type: 'distribution', t: target.t, state: target.targets[0] });
      if (target.targets.length === 1) add(e, `That is μ${target.t === 2 ? '₂' : 'ₜ'}(target): the probability of being there at step ${target.t}. Arriving by step ${target.t} also counts paths that arrived earlier and left again.`);
      break;
    }
    case 'stationary': {
      const e = evaluateTarget(snapshot, { type: 'distribution', t: 1, state: target.state });
      add(e, 'That is μ₁, one step from the start. π solves πP = π; it does not depend on the start.');
      break;
    }
  }
  return out;
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

function check(def: ChallengeDefinition, a: Assertion, sub: Submission): Omit<AssertionResult, 'criterion'> & { why: string } {
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
      if (Math.abs(given - exact) <= a.tolerance) return { passed: true, message: `${a.label}: ${formatProbability(given, 6)} is correct.`, why: '' };
      const known = diagnoseNumeric(def.starter, a.target).find((d) => Math.abs(d.value - given) <= Math.max(a.tolerance, 1e-9) && Math.abs(d.value - exact) > a.tolerance);
      return { passed: false, message: `${a.label}: ${formatProbability(given, 6)} is not correct.`, why: known?.why ?? GENERIC_WHY[a.target.type](a.target) };
    }
    case 'choice-answer': {
      const raw = sub.answers[a.key];
      const pick = raw === undefined || raw === '' ? -1 : Number(raw);
      if (!(pick >= 0 && pick < a.choices.length)) return { passed: false, message: `${a.label}: choose an answer.`, why: 'Each question needs one selected option before it can be checked.' };
      return pick === a.correct
        ? { passed: true, message: `${a.label}: “${a.choices[pick]}” is correct. ${a.explanations[pick] ?? ''}`.trim(), why: '' }
        : { passed: false, message: `${a.label}: “${a.choices[pick]}” is not correct.`, why: a.explanations[pick] ?? '' };
    }
    case 'state-set': {
      const exact = evaluateStateSet(def.starter, a.target);
      if (!exact) return { passed: false, message: 'This question’s model is invalid.', why: 'Contact your instructor.' };
      const chosen = (sub.answers[a.key] ?? '').split(',').filter(Boolean);
      const lab = (id: StateId) => def.starter.states.find((x) => x.id === id)?.label ?? id;
      const missing = exact.filter((id) => !chosen.includes(id));
      const extra = chosen.filter((id) => !exact.includes(id));
      if (!missing.length && !extra.length) return { passed: true, message: `${a.label}: {${exact.map(lab).join(', ')}} is correct.`, why: '' };
      const parts = [extra.length ? `${extra.map(lab).join(', ')} should not be included` : '', missing.length ? `${missing.length} state${missing.length > 1 ? 's are' : ' is'} missing` : ''].filter(Boolean);
      return { passed: false, message: `${a.label}: ${parts.join('; ')}.`, why: a.why };
    }
  }
}

const GENERIC_WHY: Record<NumericTarget['type'], (t: NumericTarget) => string> = {
  path: (t) => (t.type === 'path' && t.mode === 'joint' ? 'A joint path probability multiplies the starting probability μ₀(first state) by one transition probability per step.' : 'Given the starting state, multiply one transition probability for each step — do not include μ₀.'),
  distribution: () => 'μₜ(j) adds up the probabilities of every path that ends in j at step t, not just one path.',
  stationary: () => 'Solve πP = π together with Σπ = 1. For two states, balance the flows: π(A)·P(A→B) = π(B)·P(B→A).',
  absorb: () => 'Write one equation per transient state: hᵢ = Σⱼ Pᵢⱼ hⱼ with h = 1 in the target outcome and 0 in the other absorbing states.',
  'expected-steps': () => 'Write one equation per transient state: tᵢ = 1 + Σⱼ Pᵢⱼ tⱼ over transient j (absorbing states contribute 0).',
  'hit-by': () => 'Add the probability of first arriving at step 0, 1, …, t. Once a path has arrived, it counts even if it leaves again.',
};

/** Rubric criterion each assertion checks — the checklist learners see. */
export function criterionOf(a: Assertion, def?: ChallengeDefinition): string {
  const n = (r: string) => (def?.roles?.includes(r) ? r : def?.starter.states.find((x) => x.id === r)?.label ?? r);
  switch (a.kind) {
    case 'rows-valid': return 'Every row is a probability distribution';
    case 'initial-valid': return 'The starting distribution totals 1';
    case 'state-count': return `The model has ${a.equals} states`;
    case 'transition': return `P(${n(a.from)} → ${n(a.to)}) matches the scenario`;
    case 'transition-positive': return `${n(a.from)} → ${n(a.to)} stays possible`;
    case 'numeric-answer': return a.label;
    case 'choice-answer': return a.label;
    case 'state-set': return a.label;
    case 'rows-locked': return 'Only permitted rows changed';
    case 'transition-range': return 'Scenario constraint respected';
    case 'metric': return `${a.metric.label} meets the goal`;
  }
}

/** Deterministic grading from exact model calculations (no randomness, no canvas coordinates). */
export function assessChallenge(def: ChallengeDefinition, sub: Submission): AssessmentResult {
  const checked = def.assertions.map((a) => ({ ...check(def, a, sub), criterion: criterionOf(a, def) }));
  const passed = checked.every((r) => r.passed);
  return {
    challengeId: def.id,
    version: def.version,
    passed,
    correct: checked.filter((r) => r.passed).map((r) => r.message),
    needsAttention: checked.filter((r) => !r.passed).map((r) => ({ message: r.message, why: r.why })),
    next: passed ? def.nextConcept : 'Use the next hint if you are stuck — hints never cost you the challenge.',
    results: checked.map(({ passed: p, message, criterion }) => ({ passed: p, message, criterion })),
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
