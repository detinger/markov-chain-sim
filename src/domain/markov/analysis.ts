import { column, identity, solve, type Mat } from './linalg';
import { compensatedSum, EPS_SOLVE } from './numeric';
import { classifyChain, reachableFrom, supportGraph, type StructureResult } from './structure';
import type { AnalysisOutcome, CompiledChain, ScalarResult, StateId } from './types';

const ok = <T>(chain: CompiledChain, result: T, method: string, residual?: number, warnings: string[] = []): AnalysisOutcome<T> => ({
  status: 'ok', result, method, residual, warnings, modelHash: chain.modelHash,
});

// ───────────────────────────── Distribution evolution ─────────────────────────────

export function stepDistribution(mu: readonly number[], P: readonly (readonly number[])[]): number[] {
  const n = P.length;
  const next = new Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    const terms: number[] = [];
    for (let i = 0; i < n; i++) if (mu[i] !== 0 && P[i][j] !== 0) terms.push(mu[i] * P[i][j]);
    next[j] = compensatedSum(terms);
  }
  return next;
}

/** μₜ for t = 0…horizon, with μ₀ = chain.initial unless overridden. */
export function evolveDistribution(
  chain: CompiledChain,
  horizon: number,
  initial: readonly number[] = chain.initial,
): AnalysisOutcome<number[][]> {
  if (!Number.isInteger(horizon) || horizon < 0) return { status: 'invalid', issues: ['Horizon must be a whole number ≥ 0.'] };
  const series: number[][] = [[...initial]];
  for (let t = 0; t < horizon; t++) series.push(stepDistribution(series[t], chain.P));
  return ok(chain, series, 'μₜ₊₁ = μₜ P (compensated sums)');
}

// ───────────────────────────── Path probability ─────────────────────────────

export type PathMode = 'joint' | 'conditional';

export interface PathFactor {
  kind: 'initial' | 'transition';
  from?: StateId;
  to: StateId;
  value: number;
}

export interface PathResult {
  mode: PathMode;
  transitions: number;
  factors: PathFactor[];
  probability: number;
  /** Natural-log probability, −Infinity if any factor is zero. */
  logProbability: number;
  /** Index in `factors` of the first zero factor, or −1. */
  firstZeroFactor: number;
  /** Positive mathematically but below the binary64 range. */
  underflow: boolean;
  /** Conditional mode starts from a state that has zero initial mass. */
  counterfactualStart: boolean;
}

export function pathProbability(chain: CompiledChain, path: readonly StateId[], mode: PathMode): AnalysisOutcome<PathResult> {
  if (path.length === 0) return { status: 'invalid', issues: ['Add states to build a path.'], modelHash: chain.modelHash };
  const index = new Map(chain.stateIds.map((id, i) => [id, i]));
  const idx = path.map((id) => index.get(id));
  if (idx.some((i) => i === undefined)) {
    return { status: 'invalid', issues: ['The path refers to a state that no longer exists.'], modelHash: chain.modelHash };
  }
  const factors: PathFactor[] = [];
  if (mode === 'joint') factors.push({ kind: 'initial', to: path[0], value: chain.initial[idx[0]!] });
  for (let r = 0; r < path.length - 1; r++) {
    factors.push({ kind: 'transition', from: path[r], to: path[r + 1], value: chain.P[idx[r]!][idx[r + 1]!] });
  }
  const firstZeroFactor = factors.findIndex((f) => f.value === 0);
  const logProbability = firstZeroFactor >= 0 ? -Infinity : compensatedSum(factors.map((f) => Math.log(f.value)));
  const probability = firstZeroFactor >= 0 ? 0 : Math.exp(logProbability);
  return ok(chain, {
    mode,
    transitions: path.length - 1,
    factors,
    probability,
    logProbability,
    firstZeroFactor,
    underflow: firstZeroFactor < 0 && probability === 0,
    counterfactualStart: mode === 'conditional' && chain.initial[idx[0]!] === 0,
  }, 'Product of factors via sum of logarithms');
}

// ───────────────────────────── Stationary distributions ─────────────────────────────

export interface ClassStationary {
  classIndex: number;
  states: number[];
  period: number;
  /** Full-length vector, zero outside the class. */
  pi: number[];
  /** Mean return time 1/πᵢ for states in the class (indexed like the chain). */
  meanReturn: Record<number, number>;
}

export interface StationaryResult {
  structure: StructureResult;
  extremal: ClassStationary[];
  unique: boolean;
  /** Probability that the chain started from μ₀ eventually enters each closed class. */
  classWeights: number[];
  /** Σ wₖ πₖ — the Cesàro limit of μₜ from μ₀. */
  mixture: number[];
  /** Ordinary convergence μₜ → mixture is guaranteed (all weighted closed classes aperiodic). */
  convergenceGuaranteed: boolean;
  normalizationError: number;
  summary: string;
}

function solveClassStationary(P: readonly (readonly number[])[], states: number[]): { pi: number[]; residual: number } | null {
  const m = states.length;
  if (m === 1) return { pi: [1], residual: 0 };
  // Solve πᵀ (P_CC − I) = 0 → (P_CCᵀ − I) πᵀ = 0, replacing the last equation with Σπ = 1.
  const A: Mat = Array.from({ length: m }, (_, r) =>
    Array.from({ length: m }, (_, c) => P[states[c]][states[r]] - (r === c ? 1 : 0)),
  );
  A[m - 1] = new Array(m).fill(1);
  const b = new Array(m).fill(0);
  b[m - 1] = 1;
  const sol = solve(A, column(b));
  if (!sol) return null;
  let pi = sol.X.map((r) => r[0]);
  if (pi.some((v) => v < -EPS_SOLVE)) return null;
  pi = pi.map((v) => (v < 0 ? 0 : v));
  const s = compensatedSum(pi);
  pi = pi.map((v) => v / s);
  // Residual ‖πP − π‖₁ restricted to the class.
  let residual = 0;
  for (let c = 0; c < m; c++) {
    let acc = -pi[c];
    for (let r = 0; r < m; r++) acc += pi[r] * P[states[r]][states[c]];
    residual += Math.abs(acc);
  }
  return { pi, residual };
}

/** Probability, from each transient state, of eventually entering each closed class. */
function classEntryProbabilities(P: readonly (readonly number[])[], transient: number[], closed: number[][]): Mat | null {
  if (transient.length === 0) return [];
  const A: Mat = transient.map((i) => transient.map((j) => (i === j ? 1 : 0) - P[i][j]));
  const B: Mat = transient.map((i) => closed.map((cls) => compensatedSum(cls.map((j) => P[i][j]))));
  const sol = solve(A, B);
  return sol ? sol.X : null;
}

export function stationaryDistributions(chain: CompiledChain): AnalysisOutcome<StationaryResult> {
  const structOutcome = classifyChain(chain);
  if (structOutcome.status !== 'ok') return structOutcome;
  const structure = structOutcome.result;
  const n = chain.P.length;
  const closedClasses = structure.classes
    .map((c, k) => ({ ...c, k }))
    .filter((c) => c.closed);

  const extremal: ClassStationary[] = [];
  let worstResidual = 0;
  for (const c of closedClasses) {
    const sol = solveClassStationary(chain.P, c.states);
    if (!sol || sol.residual > 1e-8) {
      return { status: 'numerical-failure', issues: ['Calculation could not meet the numerical accuracy target.'], modelHash: chain.modelHash };
    }
    worstResidual = Math.max(worstResidual, sol.residual);
    const pi = new Array(n).fill(0);
    const meanReturn: Record<number, number> = {};
    c.states.forEach((s, i) => { pi[s] = sol.pi[i]; meanReturn[s] = 1 / sol.pi[i]; });
    extremal.push({ classIndex: c.k, states: c.states, period: c.period ?? 1, pi, meanReturn });
  }

  const entry = classEntryProbabilities(chain.P, structure.transient, closedClasses.map((c) => c.states));
  if (!entry) return { status: 'numerical-failure', issues: ['Class-entry probabilities could not be solved accurately.'], modelHash: chain.modelHash };
  const tIndex = new Map(structure.transient.map((s, i) => [s, i]));
  const classWeights = closedClasses.map((c, k) => {
    const terms: number[] = c.states.map((s) => chain.initial[s]);
    for (const [s, i] of tIndex) terms.push(chain.initial[s] * entry[i][k]);
    return Math.min(1, Math.max(0, compensatedSum(terms)));
  });
  const mixture = new Array(n).fill(0);
  extremal.forEach((e, k) => e.pi.forEach((v, i) => (mixture[i] += classWeights[k] * v)));
  const convergenceGuaranteed = extremal.every((e, k) => classWeights[k] <= 0 || e.period === 1);
  const unique = extremal.length === 1;
  const normalizationError = Math.max(...extremal.map((e) => Math.abs(compensatedSum(e.pi) - 1)));

  let summary: string;
  if (unique && structure.irreducible && extremal[0].period === 1) summary = 'One stationary distribution. This chain is irreducible and aperiodic.';
  else if (unique && extremal[0].period === 1) summary = 'One stationary distribution. Transient states eventually empty into a single closed class.';
  else if (unique) summary = 'One stationary distribution exists; convergence is not guaranteed because the closed class is periodic.';
  else summary = `${extremal.length} closed classes. Long-run outcomes depend on the starting distribution; any mixture of the class vectors is stationary.`;

  const warnings: string[] = [];
  if (!convergenceGuaranteed) warnings.push('Stationary distribution exists; convergence is not guaranteed from this start.');
  return ok(chain, {
    structure, extremal, unique, classWeights, mixture, convergenceGuaranteed, normalizationError, summary,
  }, 'Per-closed-class linear solve with partial pivoting (one equation replaced by normalization)', worstResidual, warnings);
}

// ───────────────────────────── Absorption ─────────────────────────────

export interface AbsorptionResult {
  transient: number[];
  absorbing: number[];
  /** B[i][a]: probability transient i ends in absorbing[a]. */
  B: number[][];
  /** Expected transitions to absorption from each transient state. */
  t: number[];
  /** Variance of the number of transitions (steps²). */
  variance: number[];
  /** N[i][j]: expected visits to transient j starting from transient i (including time 0). */
  N: number[][];
}

export function absorptionAnalysis(chain: CompiledChain): AnalysisOutcome<AbsorptionResult> {
  const sOut = classifyChain(chain);
  if (sOut.status !== 'ok') return sOut;
  const s = sOut.result;
  if (s.absorbing.length === 0) {
    return { status: 'unsupported', issues: ['This chain has no absorbing state.'], modelHash: chain.modelHash };
  }
  const nonAbsorbingClosed = s.classes.filter((c) => c.closed && !(c.states.length === 1 && s.absorbing.includes(c.states[0])));
  if (nonAbsorbingClosed.length) {
    return {
      status: 'unsupported',
      issues: ['Not an absorbing chain: some closed class is not a single absorbing state, so not every path is absorbed.'],
      modelHash: chain.modelHash,
    };
  }
  const T = s.transient;
  const Abs = s.absorbing;
  if (T.length === 0) return ok(chain, { transient: [], absorbing: Abs, B: [], t: [], variance: [], N: [] }, 'trivial');
  const IQ: Mat = T.map((i) => T.map((j) => (i === j ? 1 : 0) - chain.P[i][j]));
  const R: Mat = T.map((i) => Abs.map((a) => chain.P[i][a]));
  const ones = column(new Array(T.length).fill(1));
  const rhs = R.map((row, i) => [...row, ones[i][0], ...identity(T.length)[i]]);
  const sol = solve(IQ, rhs);
  if (!sol || sol.residual > 1e-8 * Math.max(1, ...sol.X.flat().map(Math.abs))) {
    return { status: 'numerical-failure', issues: ['Calculation could not meet the numerical accuracy target.'], modelHash: chain.modelHash };
  }
  const a = Abs.length;
  const B = sol.X.map((r) => r.slice(0, a));
  const t = sol.X.map((r) => r[a]);
  const N = sol.X.map((r) => r.slice(a + 1));
  const Nt = N.map((row) => compensatedSum(row.map((v, j) => v * t[j])));
  const variance = t.map((ti, i) => 2 * Nt[i] - ti - ti * ti);
  const warnings = sol.pivotRatio < 1e-8 ? ['Near-absorbing loops make this solve ill-conditioned; treat large values with care.'] : [];
  return ok(chain, { transient: T, absorbing: Abs, B, t, variance, N }, 'LU solve of (I−Q)[B t N] = [R 1 I]', sol.residual, warnings);
}

// ───────────────────────────── Hitting times ─────────────────────────────

export interface HittingResult {
  targets: number[];
  /** hᵢ = Prᵢ(T_A < ∞) */
  probability: number[];
  /** Unconditional E[T_A]; infinite when hitting is not almost sure. */
  meanTime: ScalarResult[];
  /** E[T_A | T_A < ∞]; undefined when hᵢ = 0. */
  conditionalMeanTime: ScalarResult[];
}

export function hittingAnalysis(chain: CompiledChain, targetIds: readonly StateId[]): AnalysisOutcome<HittingResult> {
  const n = chain.P.length;
  const index = new Map(chain.stateIds.map((id, i) => [id, i]));
  const targets = targetIds.map((id) => index.get(id)).filter((i): i is number => i !== undefined);
  if (targets.length === 0) return { status: 'invalid', issues: ['Choose at least one target state.'], modelHash: chain.modelHash };
  const inA = new Array(n).fill(false);
  targets.forEach((i) => (inA[i] = true));

  // Stopped chain: targets have no outgoing edges.
  const adj = supportGraph(chain.P).map((succ, i) => (inA[i] ? [] : succ));
  const reverse: number[][] = Array.from({ length: n }, () => []);
  adj.forEach((succ, i) => succ.forEach((j) => reverse[j].push(i)));
  const canReach = reachableFrom(reverse, targets);
  // States that can reach a state that cannot reach A (without passing through A) miss with positive probability.
  const cannot = canReach.flatMap((r, i) => (r ? [] : [i]));
  const reachesBad = reachableFrom(reverse, cannot);
  const almostSure = Array.from({ length: n }, (_, i) => inA[i] || (canReach[i] && !reachesBad[i]));

  const probability = new Array(n).fill(0);
  targets.forEach((i) => (probability[i] = 1));
  const U = Array.from({ length: n }, (_, i) => i).filter((i) => !inA[i] && canReach[i]);
  let residual = 0;
  if (U.length) {
    const A: Mat = U.map((i) => U.map((j) => (i === j ? 1 : 0) - chain.P[i][j]));
    const b = U.map((i) => compensatedSum(targets.map((a) => chain.P[i][a])));
    const sol = solve(A, column(b));
    if (!sol) return { status: 'numerical-failure', issues: ['Hitting probabilities could not be solved accurately.'], modelHash: chain.modelHash };
    residual = sol.residual;
    U.forEach((i, k) => (probability[i] = almostSure[i] ? 1 : Math.min(1, Math.max(0, sol.X[k][0]))));
  }

  const meanTime: ScalarResult[] = new Array(n).fill(null).map((_, i) =>
    inA[i] ? { kind: 'finite', value: 0 } : { kind: 'infinite' },
  );
  const S = U.filter((i) => almostSure[i]);
  if (S.length) {
    const A: Mat = S.map((i) => S.map((j) => (i === j ? 1 : 0) - chain.P[i][j]));
    const sol = solve(A, column(new Array(S.length).fill(1)));
    if (!sol) return { status: 'numerical-failure', issues: ['Expected hitting times could not be solved accurately.'], modelHash: chain.modelHash };
    residual = Math.max(residual, sol.residual / Math.max(1, ...sol.X.map((r) => Math.abs(r[0]))));
    S.forEach((i, k) => (meanTime[i] = { kind: 'finite', value: sol.X[k][0] }));
  }

  const conditionalMeanTime: ScalarResult[] = new Array(n).fill(null).map((_, i) =>
    inA[i] ? { kind: 'finite', value: 0 } : { kind: 'undefined', reason: 'The target is never reached from this state.' },
  );
  const H = U.filter((i) => probability[i] > 0);
  if (H.length) {
    // Conditioned kernel P*ᵢⱼ = Pᵢⱼ hⱼ / hᵢ.
    const A: Mat = H.map((i) => H.map((j) => (i === j ? 1 : 0) - (chain.P[i][j] * probability[j]) / probability[i]));
    const sol = solve(A, column(new Array(H.length).fill(1)));
    if (sol) H.forEach((i, k) => (conditionalMeanTime[i] = { kind: 'finite', value: sol.X[k][0] }));
  }

  return ok(chain, { targets, probability, meanTime, conditionalMeanTime },
    'Linear solves on the target-stopped chain; almost-sure reachability from closed-class structure', residual);
}

// ───────────────────────────── Finite-horizon first arrival ─────────────────────────────

/** Pr(T_A ≤ t) for t = 0…horizon from μ₀, via target-killed propagation. */
export function firstArrivalByHorizon(chain: CompiledChain, targetIds: readonly StateId[], horizon: number): number[] {
  const index = new Map(chain.stateIds.map((id, i) => [id, i]));
  const inA = new Array(chain.P.length).fill(false);
  targetIds.forEach((id) => { const i = index.get(id); if (i !== undefined) inA[i] = true; });
  let v = chain.initial.map((p, i) => (inA[i] ? 0 : p));
  let cumulative = compensatedSum(chain.initial.filter((_, i) => inA[i]));
  const out = [cumulative];
  for (let t = 1; t <= horizon; t++) {
    const next = stepDistribution(v, chain.P);
    cumulative += compensatedSum(next.filter((_, i) => inA[i]));
    v = next.map((p, i) => (inA[i] ? 0 : p));
    out.push(Math.min(1, cumulative));
  }
  return out;
}
