// Baseline → alternative comparison (PLAN.md Module F, Phase 5). Pure: no React, no storage.
//
// Both scenarios are evaluated with the same metric definitions, horizon, and (mapped) target set.
// Changes are reported as signed differences; probabilities in percentage points. Relative change
// is only defined for a finite, nonzero baseline. No metric is "better" unless an objective is given.

import { absorptionAnalysis, evolveDistribution, firstArrivalByHorizon, hittingAnalysis } from '../markov/analysis';
import { compileChain, initialVector, rowOf } from '../markov/compile';
import { compensatedSum } from '../markov/numeric';
import type { ChainDocumentV1, CompiledChain, ScalarResult, StateId } from '../markov/types';

export const COMPARISON_VERSION = 'comparison-v1';

// ───────────────────────────── State alignment ─────────────────────────────

export interface StateAlignment {
  /** How pairs were obtained. Equal labels are never treated as identity. */
  source: 'stable-id' | 'explicit' | 'none';
  pairs: { base: StateId; alt: StateId }[];
  baseOnly: StateId[];
  altOnly: StateId[];
}

/** Align a duplicated alternative by stable state IDs. Unrelated models (no shared IDs) get source 'none'. */
export function alignByStableId(base: ChainDocumentV1, alt: ChainDocumentV1): StateAlignment {
  const altIds = new Set(alt.stateOrder);
  const pairs = base.stateOrder.filter((id) => altIds.has(id)).map((id) => ({ base: id, alt: id }));
  if (!pairs.length) return { source: 'none', pairs: [], baseOnly: [...base.stateOrder], altOnly: [...alt.stateOrder] };
  const paired = new Set(pairs.map((p) => p.base));
  return {
    source: 'stable-id',
    pairs,
    baseOnly: base.stateOrder.filter((id) => !paired.has(id)),
    altOnly: alt.stateOrder.filter((id) => !paired.has(id)),
  };
}

/** Explicit learner-supplied mapping baseline → alternative. Must be one-to-one; unmapped states stay unaligned. */
export function alignExplicit(base: ChainDocumentV1, alt: ChainDocumentV1, map: Record<StateId, StateId>): StateAlignment | { error: string } {
  const used = new Set<StateId>();
  const pairs: StateAlignment['pairs'] = [];
  for (const b of base.stateOrder) {
    const a = map[b];
    if (!a) continue;
    if (!alt.stateOrder.includes(a)) return { error: 'A mapping points at a state that no longer exists in the alternative.' };
    if (used.has(a)) return { error: 'Each alternative state can be matched to only one baseline state.' };
    used.add(a);
    pairs.push({ base: b, alt: a });
  }
  return {
    source: pairs.length ? 'explicit' : 'none',
    pairs,
    baseOnly: base.stateOrder.filter((b) => !pairs.some((p) => p.base === b)),
    altOnly: alt.stateOrder.filter((a) => !used.has(a)),
  };
}

const toAlt = (al: StateAlignment, b: StateId) => al.pairs.find((p) => p.base === b)?.alt;

// ───────────────────────────── Model changes ─────────────────────────────

export type ModelChange =
  | { kind: 'transition'; from: StateId; to: StateId; altFrom: StateId; altTo: StateId; base: number; alt: number }
  | { kind: 'initial'; state: StateId; altState: StateId; base: number; alt: number }
  | { kind: 'state-removed'; state: StateId; label: string }
  | { kind: 'state-added'; state: StateId; label: string }
  | { kind: 'renamed'; state: StateId; from: string; to: string }
  | { kind: 'step-label'; base?: string; alt?: string };

const labelIn = (d: ChainDocumentV1, id: StateId) => d.states.find((s) => s.id === id)?.label || 'Unnamed';

/** Every probability, start-distribution, state, and assumption difference (exact comparison, no tolerance). */
export function modelChanges(base: ChainDocumentV1, alt: ChainDocumentV1, al: StateAlignment): ModelChange[] {
  const out: ModelChange[] = [];
  const bi = initialVector(base);
  const ai = initialVector(alt);
  for (const { base: bf, alt: af } of al.pairs) {
    const brow = rowOf(base, bf);
    const arow = rowOf(alt, af);
    for (const { base: bt, alt: at } of al.pairs) {
      const p = brow[base.stateOrder.indexOf(bt)] ?? 0;
      const q = arow[alt.stateOrder.indexOf(at)] ?? 0;
      if (p !== q) out.push({ kind: 'transition', from: bf, to: bt, altFrom: af, altTo: at, base: p, alt: q });
    }
    // Mass moved to or from unaligned states is also a probability change.
    for (const bt of al.baseOnly) {
      const p = brow[base.stateOrder.indexOf(bt)] ?? 0;
      if (p !== 0) out.push({ kind: 'transition', from: bf, to: bt, altFrom: af, altTo: '', base: p, alt: 0 });
    }
    for (const at of al.altOnly) {
      const q = arow[alt.stateOrder.indexOf(at)] ?? 0;
      if (q !== 0) out.push({ kind: 'transition', from: bf, to: '', altFrom: af, altTo: at, base: 0, alt: q });
    }
    const p0 = bi[base.stateOrder.indexOf(bf)];
    const q0 = ai[alt.stateOrder.indexOf(af)];
    if (p0 !== q0) out.push({ kind: 'initial', state: bf, altState: af, base: p0, alt: q0 });
    const bl = labelIn(base, bf);
    const alabel = labelIn(alt, af);
    if (bl !== alabel) out.push({ kind: 'renamed', state: bf, from: bl, to: alabel });
  }
  al.baseOnly.forEach((id) => out.push({ kind: 'state-removed', state: id, label: labelIn(base, id) }));
  al.altOnly.forEach((id) => out.push({ kind: 'state-added', state: id, label: labelIn(alt, id) }));
  if ((base.metadata.stepLabel ?? '') !== (alt.metadata.stepLabel ?? '')) out.push({ kind: 'step-label', base: base.metadata.stepLabel, alt: alt.metadata.stepLabel });
  return out;
}

// ───────────────────────────── Change semantics ─────────────────────────────

export type MetricUnit = 'probability' | 'steps' | 'reward' | 'fraction';

export interface Change {
  /** alt − base. For probabilities/fractions this is in probability units; display ×100 as percentage points. */
  difference: ScalarResult;
  /** (alt − base)/|base| × 100, only for a finite nonzero baseline. */
  relative: ScalarResult;
  direction: 'up' | 'down' | 'same' | null;
}

/** Compare two scalars without ever producing NaN/Infinity arithmetic (PLAN.md Module F). */
export function compareScalars(base: ScalarResult, alt: ScalarResult): Change {
  const nd = (reason: string): ScalarResult => ({ kind: 'undefined', reason });
  if (base.kind === 'undefined' || alt.kind === 'undefined') {
    const why = base.kind === 'undefined' ? `Not defined for the baseline: ${base.reason}` : `Not defined for the alternative: ${(alt as { reason: string }).reason}`;
    return { difference: nd(why), relative: nd(why), direction: null };
  }
  if (base.kind === 'infinite' && alt.kind === 'infinite') {
    return { difference: nd('Both values are infinite.'), relative: nd('Both values are infinite.'), direction: 'same' };
  }
  if (base.kind === 'infinite') {
    return { difference: nd('The baseline is infinite; the alternative is finite.'), relative: nd('The baseline is infinite.'), direction: 'down' };
  }
  if (alt.kind === 'infinite') {
    return { difference: { kind: 'infinite' }, relative: nd('The alternative is infinite.'), direction: 'up' };
  }
  const d = alt.value - base.value;
  const scale = Math.max(1, Math.abs(base.value), Math.abs(alt.value));
  const same = Math.abs(d) <= 1e-12 * scale;
  return {
    difference: { kind: 'finite', value: same ? 0 : d },
    relative: base.value === 0 ? nd('The baseline is 0, so a relative change is not defined.') : { kind: 'finite', value: same ? 0 : (d / Math.abs(base.value)) * 100 },
    direction: same ? 'same' : d > 0 ? 'up' : 'down',
  };
}

export type Objective = 'increase' | 'decrease' | null;

/** Good/bad is scenario-specific: without an objective there is no verdict. */
export function judge(change: Change, objective: Objective): 'improves' | 'worsens' | 'unchanged' | null {
  if (!objective || !change.direction) return null;
  if (change.direction === 'same') return 'unchanged';
  return (change.direction === 'up') === (objective === 'increase') ? 'improves' : 'worsens';
}

// ───────────────────────────── Metrics ─────────────────────────────

export interface ComparisonSpec {
  /** Shared finite horizon H (transitions). */
  horizon: number;
  /** Target set in baseline IDs; mapped through the alignment for the alternative. */
  targetIds: StateId[];
  /** Optional per-visit reward r(i), keyed by state ID of either scenario. */
  rewards?: Record<StateId, number>;
}

export interface MetricRow {
  id: string;
  label: string;
  definition: string;
  unit: MetricUnit;
  base: ScalarResult;
  alt: ScalarResult;
  change: Change;
  /** Disclosure when the two values are not computed on identical terms. */
  note?: string;
}

export interface PerStateRow {
  base: StateId;
  alt: StateId;
  label: string;
  distribution: { base: number; alt: number; change: Change };
  occupancy: { base: number; alt: number; change: Change };
}

export interface ComparisonResult {
  version: typeof COMPARISON_VERSION;
  spec: ComparisonSpec;
  alignment: StateAlignment;
  changes: ModelChange[];
  metrics: MetricRow[];
  perState: PerStateRow[];
  /** Pr(T_A ≤ t), t = 0…H, for each scenario (null when no target or unmapped). */
  arrival: { base: number[] | null; alt: number[] | null };
  baseHash: string;
  altHash: string;
}

const fin = (value: number): ScalarResult => ({ kind: 'finite', value });
const und = (reason: string): ScalarResult => ({ kind: 'undefined', reason });

interface ScenarioValues {
  hitByH: ScalarResult;
  hitEventually: ScalarResult;
  meanHit: ScalarResult;
  meanHitConditional: ScalarResult;
  stepsToAbsorb: ScalarResult;
  absorbInto: Map<StateId, ScalarResult>;
  reward: ScalarResult;
  arrival: number[] | null;
  muH: number[];
  occupancy: number[];
}

function scenarioValues(doc: ChainDocumentV1, chain: CompiledChain, spec: ComparisonSpec, targets: StateId[] | null, absorbCandidates: StateId[]): ScenarioValues {
  const H = spec.horizon;
  const evo = evolveDistribution(chain, H);
  const series = evo.status === 'ok' ? evo.result : [];
  const n = chain.P.length;
  const muH = series[H] ?? new Array(n).fill(0);
  const occupancy = Array.from({ length: n }, (_, i) => compensatedSum(series.map((mu) => mu[i])) / (H + 1));
  const mu0 = chain.initial;

  let hitByH: ScalarResult = und('Choose at least one target state.');
  let hitEventually = hitByH;
  let meanHit = hitByH;
  let meanHitConditional = hitByH;
  let arrival: number[] | null = null;
  if (targets === null) {
    hitByH = hitEventually = meanHit = meanHitConditional = und('A target state has no counterpart in this scenario.');
  } else if (targets.length) {
    arrival = firstArrivalByHorizon(chain, targets, H);
    hitByH = fin(arrival[H]);
    const h = hittingAnalysis(chain, targets);
    if (h.status === 'ok') {
      hitEventually = fin(Math.min(1, compensatedSum(mu0.map((p, i) => p * h.result.probability[i]))));
      const supported = mu0.map((p, i) => [p, i] as const).filter(([p]) => p > 0);
      const anyInfinite = supported.some(([, i]) => h.result.meanTime[i].kind !== 'finite');
      meanHit = anyInfinite ? { kind: 'infinite' } : fin(compensatedSum(supported.map(([p, i]) => p * (h.result.meanTime[i] as { value: number }).value)));
      // E[T | T < ∞] from μ₀ = Σ μ₀(i) hᵢ E_i[T | T<∞] / Σ μ₀(i) hᵢ.
      const reach = compensatedSum(supported.map(([p, i]) => p * h.result.probability[i]));
      if (reach === 0) meanHitConditional = und('The target is never reached from the starting distribution.');
      else {
        const parts = supported.filter(([, i]) => h.result.probability[i] > 0);
        const ok = parts.every(([, i]) => h.result.conditionalMeanTime[i].kind === 'finite');
        meanHitConditional = ok
          ? fin(compensatedSum(parts.map(([p, i]) => p * h.result.probability[i] * (h.result.conditionalMeanTime[i] as { value: number }).value)) / reach)
          : und('The conditional time could not be computed accurately.');
      }
    } else {
      hitEventually = meanHit = meanHitConditional = und(h.issues.join(' '));
    }
  }

  const ab = absorptionAnalysis(chain);
  let stepsToAbsorb: ScalarResult;
  const absorbInto = new Map<StateId, ScalarResult>();
  if (ab.status === 'ok') {
    const tOf = new Map(ab.result.transient.map((i, k) => [i, ab.result.t[k]]));
    stepsToAbsorb = fin(compensatedSum(mu0.map((p, i) => p * (tOf.get(i) ?? 0))));
    for (const id of absorbCandidates) {
      const a = chain.stateIds.indexOf(id);
      const col = ab.result.absorbing.indexOf(a);
      if (a < 0) { absorbInto.set(id, und('This state does not exist in this scenario.')); continue; }
      if (col < 0) { absorbInto.set(id, und('This state is not absorbing in this scenario.')); continue; }
      const rowOfT = new Map(ab.result.transient.map((i, k) => [i, k]));
      absorbInto.set(id, fin(compensatedSum(mu0.map((p, i) => {
        if (i === a) return p;
        const k = rowOfT.get(i);
        return k === undefined ? 0 : p * ab.result.B[k][col];
      }))));
    }
  } else {
    const reason = ab.issues.join(' ');
    stepsToAbsorb = und(reason);
    absorbCandidates.forEach((id) => absorbInto.set(id, und(reason)));
  }

  let reward: ScalarResult = und('No rewards were specified.');
  if (spec.rewards && Object.keys(spec.rewards).length) {
    const missing = doc.stateOrder.filter((id) => !Number.isFinite(spec.rewards![id]));
    reward = missing.length
      ? und(`Give a reward for ${missing.map((id) => labelIn(doc, id)).join(', ')}.`)
      : fin(compensatedSum(series.map((mu) => compensatedSum(mu.map((p, i) => p * spec.rewards![chain.stateIds[i]])))));
  }

  return { hitByH, hitEventually, meanHit, meanHitConditional, stepsToAbsorb, absorbInto, reward, arrival, muH, occupancy };
}

/** Exact comparison of two valid scenarios under one shared specification. */
export function compareScenarios(baseDoc: ChainDocumentV1, altDoc: ChainDocumentV1, al: StateAlignment, spec: ComparisonSpec):
  { ok: true; result: ComparisonResult } | { ok: false; side: 'baseline' | 'alternative'; issues: string[] } {
  const bc = compileChain(baseDoc);
  if (bc.status !== 'ok') return { ok: false, side: 'baseline', issues: bc.issues };
  const ac = compileChain(altDoc);
  if (ac.status !== 'ok') return { ok: false, side: 'alternative', issues: ac.issues };
  const base = bc.result;
  const alt = ac.result;

  const altTargets = spec.targetIds.map((t) => toAlt(al, t));
  const targetsMapped = altTargets.every((t): t is StateId => !!t);

  // Absorbing states of either scenario (in baseline IDs where aligned).
  const absorbingIds = (c: CompiledChain) => c.stateIds.filter((_, i) => c.P[i][i] === 1);
  const baseAbs = absorbingIds(base);
  const altAbs = absorbingIds(alt);
  const absorbPairs = al.pairs.filter((p) => baseAbs.includes(p.base) || altAbs.includes(p.alt));

  const bv = scenarioValues(baseDoc, base, spec, spec.targetIds, absorbPairs.map((p) => p.base));
  const av = scenarioValues(altDoc, alt, spec, targetsMapped ? altTargets : null, absorbPairs.map((p) => p.alt));

  const H = spec.horizon;
  const targetNames = spec.targetIds.map((t) => labelIn(baseDoc, t)).join(', ') || 'A';
  const row = (id: string, label: string, definition: string, unit: MetricUnit, b: ScalarResult, a: ScalarResult, note?: string): MetricRow =>
    ({ id, label, definition, unit, base: b, alt: a, change: compareScalars(b, a), note });

  const metrics: MetricRow[] = [];
  if (spec.targetIds.length) {
    const note = !targetsMapped ? 'Some target states have no counterpart in the alternative, so target metrics cannot be compared.' : undefined;
    metrics.push(
      row('hit-by-h', `Reach {${targetNames}} within ${H} steps`, `Pr(T_A ≤ ${H}) from μ₀, where T_A = first t ≥ 0 with Xₜ ∈ A.`, 'probability', bv.hitByH, av.hitByH, note),
      row('hit-eventually', `Ever reach {${targetNames}}`, 'Pr(T_A < ∞) from μ₀.', 'probability', bv.hitEventually, av.hitEventually, note),
      row('mean-hit', `Expected steps to reach {${targetNames}}`, 'E[T_A] from μ₀; infinite when the target may never be reached.', 'steps', bv.meanHit, av.meanHit, note),
      row('mean-hit-conditional', `Expected steps to reach {${targetNames}}, given it is reached`, 'E[T_A | T_A < ∞] from μ₀ — conditional, not the unconditional mean.', 'steps', bv.meanHitConditional, av.meanHitConditional, note),
    );
  }
  if (baseAbs.length || altAbs.length) {
    metrics.push(row('steps-to-absorb', 'Expected steps until absorption', 'Σ μ₀(i)·tᵢ with t = (I − Q)⁻¹1; only for absorbing chains.', 'steps', bv.stepsToAbsorb, av.stepsToAbsorb));
    for (const p of absorbPairs) {
      metrics.push(row(`absorb:${p.base}`, `End in ${labelIn(baseDoc, p.base)}`, 'Probability of eventual absorption in this state from μ₀.', 'probability',
        bv.absorbInto.get(p.base)!, av.absorbInto.get(p.alt)!,
        baseAbs.includes(p.base) !== altAbs.includes(p.alt) ? 'This state is absorbing in only one scenario.' : undefined));
    }
  }
  if (spec.rewards && Object.keys(spec.rewards).length) {
    metrics.push(row('reward', `Expected total reward over t = 0…${H}`, `Σₜ Σᵢ μₜ(i)·r(i): reward r(i) is earned at every observation time t = 0…${H} spent in i; no discounting.`, 'reward', bv.reward, av.reward));
  }

  const perState: PerStateRow[] = al.pairs.map(({ base: b, alt: a }) => {
    const bi = base.stateIds.indexOf(b);
    const ai = alt.stateIds.indexOf(a);
    return {
      base: b, alt: a, label: labelIn(baseDoc, b),
      distribution: { base: bv.muH[bi], alt: av.muH[ai], change: compareScalars(fin(bv.muH[bi]), fin(av.muH[ai])) },
      occupancy: { base: bv.occupancy[bi], alt: av.occupancy[ai], change: compareScalars(fin(bv.occupancy[bi]), fin(av.occupancy[ai])) },
    };
  });

  return {
    ok: true,
    result: {
      version: COMPARISON_VERSION, spec, alignment: al, changes: modelChanges(baseDoc, altDoc, al),
      metrics, perState, arrival: { base: bv.arrival, alt: av.arrival }, baseHash: base.modelHash, altHash: alt.modelHash,
    },
  };
}

/** Alternative-side target IDs for a spec (undefined entries mean unmapped). */
export function mapTargets(al: StateAlignment, targetIds: StateId[]): (StateId | undefined)[] {
  return targetIds.map((t) => toAlt(al, t));
}
