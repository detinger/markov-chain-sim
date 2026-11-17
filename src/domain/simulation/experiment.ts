// Monte Carlo experiment engine (PLAN.md Module E). Pure: no timers, no DOM, no Math.random.
// Replication r always uses stream r, so results do not depend on batching or worker count.

import { evolveDistribution, firstArrivalByHorizon } from '../markov/analysis';
import { compensatedSum } from '../markov/numeric';
import type { CompiledChain, StateId } from '../markov/types';
import { meanInterval, wilson, type Interval, type MeanSummary } from '../statistics/intervals';
import { RNG_ALGORITHM, streamKey, uniformFromKey } from './rng';
import { buildCdfRow, buildCdfTable, csvCell, sampleSlot, ENGINE_VERSION } from './trajectory';

export const EXPERIMENT_ENGINE = 'experiment-v1';
export const MAX_REPLICATIONS = 100_000;
export const MAX_HORIZON = 5_000;

export interface ExperimentConfig {
  schemaVersion: 1;
  modelHash: string;
  seed: number;
  replications: number;
  /** H transitions, H+1 observed states per replication. */
  horizon: number;
  /** Optional start override in chain order; defaults to μ₀. */
  initial?: number[];
  /** Target set A for first-hit analysis (T_A = inf{t ≥ 0 : Xₜ ∈ A}). May be empty. */
  targetIds: StateId[];
  /** Occupancy burn-in b: count t = b…H (denominator H − b + 1). Never affects first-hit results. */
  burnIn: number;
  /** Number of complete traces retained for export (bounded memory). */
  traceLimit: number;
}

export function validateExperimentConfig(chain: CompiledChain, c: ExperimentConfig): string[] {
  const errs: string[] = [];
  if (c.modelHash !== chain.modelHash) errs.push('The configuration refers to a different model version.');
  if (!Number.isInteger(c.seed) || c.seed < 0 || c.seed > 0xffffffff) errs.push('Seed must be a whole number from 0 to 4294967295.');
  if (!Number.isInteger(c.replications) || c.replications < 1 || c.replications > MAX_REPLICATIONS) errs.push(`Replications must be 1–${MAX_REPLICATIONS.toLocaleString()}.`);
  if (!Number.isInteger(c.horizon) || c.horizon < 0 || c.horizon > MAX_HORIZON) errs.push(`Horizon must be 0–${MAX_HORIZON.toLocaleString()}.`);
  if (!Number.isInteger(c.burnIn) || c.burnIn < 0 || c.burnIn > c.horizon) errs.push('Burn-in must satisfy 0 ≤ b ≤ H.');
  if (c.targetIds.some((id) => !chain.stateIds.includes(id))) errs.push('A target state no longer exists.');
  if (c.initial) {
    const s = compensatedSum(c.initial);
    if (c.initial.length !== chain.stateIds.length || c.initial.some((p) => !(p >= 0)) || Math.abs(s - 1) > 1e-12) errs.push('Start override must be a distribution that totals 1.');
  }
  return errs;
}

/** Mergeable online aggregates. All counts are exact integers stored as doubles. */
export interface Accumulator {
  n: number;
  horizon: number;
  /** Replication indices covered, as [from, to) ranges. */
  ranges: [number, number][];
  completed: number;
  /** endpoint[t * n + i] = number of replications with Xₜ = i. */
  endpoint: Float64Array;
  /** Per-state sum and sum of squares of each replication's occupancy fraction. */
  occSum: Float64Array;
  occSumSq: Float64Array;
  hitCount: number;
  /** hitHist[t] = replications whose first hit is at t. */
  hitHist: Float64Array;
  /** Σ min(T_A, H) and Σ min(T_A, H)² over replications. */
  restrictedSum: number;
  restrictedSumSq: number;
  /** Σ T_A over replications that hit by H (for the conditional mean). */
  hitTimeSum: number;
  traces: { replication: number; states: number[] }[];
}

export function emptyAccumulator(n: number, horizon: number): Accumulator {
  return {
    n, horizon, ranges: [], completed: 0,
    endpoint: new Float64Array((horizon + 1) * n),
    occSum: new Float64Array(n), occSumSq: new Float64Array(n),
    hitCount: 0, hitHist: new Float64Array(horizon + 1),
    restrictedSum: 0, restrictedSumSq: 0, hitTimeSum: 0, traces: [],
  };
}

/** Run replications [from, to) into `acc` (mutated and returned). */
export function runReplications(chain: CompiledChain, config: ExperimentConfig, from: number, to: number, acc = emptyAccumulator(chain.P.length, config.horizon)): Accumulator {
  const n = chain.P.length;
  const H = config.horizon;
  const cdf = buildCdfTable(chain);
  const initRow = buildCdfRow(config.initial ?? chain.initial);
  const inA = new Uint8Array(n);
  config.targetIds.forEach((id) => { const i = chain.stateIds.indexOf(id); if (i >= 0) inA[i] = 1; });
  const hasTarget = config.targetIds.length > 0;
  const occ = new Float64Array(n);
  const occDenom = H - config.burnIn + 1;
  const keep = config.traceLimit;

  for (let r = from; r < to; r++) {
    const key = streamKey(config.seed, r);
    occ.fill(0);
    const trace = r < keep ? [] as number[] : null;
    // t = 0: draw 0 samples X₀ (ADR 0002 draw contract).
    let x = initRow.targets[sampleSlot(initRow, uniformFromKey(key, 0))];
    let firstHit = -1;
    for (let t = 0; t <= H; t++) {
      if (t > 0) {
        const row = cdf[x];
        x = row.targets[sampleSlot(row, uniformFromKey(key, t))];
      }
      acc.endpoint[t * n + x]++;
      if (t >= config.burnIn) occ[x]++;
      if (hasTarget && firstHit < 0 && inA[x]) firstHit = t;
      if (trace) trace.push(x);
    }
    for (let i = 0; i < n; i++) {
      const f = occ[i] / occDenom;
      acc.occSum[i] += f;
      acc.occSumSq[i] += f * f;
    }
    if (hasTarget) {
      const restricted = firstHit >= 0 ? firstHit : H;
      acc.restrictedSum += restricted;
      acc.restrictedSumSq += restricted * restricted;
      if (firstHit >= 0) { acc.hitCount++; acc.hitHist[firstHit]++; acc.hitTimeSum += firstHit; }
    }
    if (trace) acc.traces.push({ replication: r, states: trace });
    acc.completed++;
  }
  acc.ranges.push([from, to]);
  return acc;
}

export function mergeAccumulators(a: Accumulator, b: Accumulator): Accumulator {
  const out = emptyAccumulator(a.n, a.horizon);
  for (const src of [a, b]) {
    out.completed += src.completed;
    out.ranges.push(...src.ranges);
    src.endpoint.forEach((v, i) => (out.endpoint[i] += v));
    src.occSum.forEach((v, i) => (out.occSum[i] += v));
    src.occSumSq.forEach((v, i) => (out.occSumSq[i] += v));
    src.hitHist.forEach((v, i) => (out.hitHist[i] += v));
    out.hitCount += src.hitCount;
    out.restrictedSum += src.restrictedSum;
    out.restrictedSumSq += src.restrictedSumSq;
    out.hitTimeSum += src.hitTimeSum;
    out.traces.push(...src.traces);
  }
  out.ranges.sort((x, y) => x[0] - y[0]);
  out.traces.sort((x, y) => x.replication - y.replication);
  return out;
}

export interface ExperimentSummary {
  completed: number;
  requested: number;
  partial: boolean;
  /** endpoint[t][i]: Wilson interval for Pr(Xₜ = i). */
  endpoint: (Interval | null)[][];
  exactEndpoint: number[][];
  occupancy: { state: number; summary: MeanSummary; exact: number }[];
  occupancyWindow: { from: number; to: number; observations: number };
  hitting: null | {
    hitByHorizon: Interval | null;
    exactHitByHorizon: number;
    hitCount: number;
    censoredCount: number;
    restrictedMean: MeanSummary;
    exactRestrictedMean: number;
    /** Mean of T_A among replications that hit by H — conditional, not the unconditional mean. */
    meanAmongHits: number | null;
    histogram: { t: number; count: number; fraction: number; exact: number }[];
  };
}

/** Turn aggregates into estimates with intervals and exact overlays. */
export function summarizeExperiment(chain: CompiledChain, config: ExperimentConfig, acc: Accumulator): ExperimentSummary {
  const n = chain.P.length;
  const H = config.horizon;
  const M = acc.completed;
  const init = config.initial ?? chain.initial;
  const evo = evolveDistribution(chain, H, init);
  const exactEndpoint = evo.status === 'ok' ? evo.result : [];

  const endpoint: (Interval | null)[][] = [];
  for (let t = 0; t <= H; t++) {
    const row: (Interval | null)[] = [];
    for (let i = 0; i < n; i++) row.push(wilson(acc.endpoint[t * n + i], M));
    endpoint.push(row);
  }
  const window = H - config.burnIn + 1;
  const occupancy = Array.from({ length: n }, (_, i) => ({
    state: i,
    summary: meanInterval(acc.occSum[i], acc.occSumSq[i], M),
    exact: compensatedSum(exactEndpoint.slice(config.burnIn).map((mu) => mu[i])) / window,
  }));

  let hitting: ExperimentSummary['hitting'] = null;
  if (config.targetIds.length) {
    const chainWithInit = { ...chain, initial: init };
    const F = firstArrivalByHorizon(chainWithInit, config.targetIds, H);
    const exactPmf = F.map((v, t) => (t === 0 ? v : v - F[t - 1]));
    let exactRestricted = 0;
    for (let t = 0; t < H; t++) exactRestricted += 1 - F[t];
    hitting = {
      hitByHorizon: wilson(acc.hitCount, M),
      exactHitByHorizon: F[H],
      hitCount: acc.hitCount,
      censoredCount: M - acc.hitCount,
      restrictedMean: meanInterval(acc.restrictedSum, acc.restrictedSumSq, M),
      exactRestrictedMean: exactRestricted,
      meanAmongHits: acc.hitCount ? acc.hitTimeSum / acc.hitCount : null,
      histogram: Array.from(acc.hitHist, (count, t) => ({ t, count, fraction: M ? count / M : 0, exact: exactPmf[t] })),
    };
  }
  return {
    completed: M, requested: config.replications, partial: M < config.replications,
    endpoint, exactEndpoint, occupancy,
    occupancyWindow: { from: config.burnIn, to: H, observations: window },
    hitting,
  };
}

export interface RunBundle {
  format: 'markov-chain-simulator/run-bundle';
  schemaVersion: 1;
  app: { rng: string; trajectoryEngine: string; experimentEngine: string };
  status: 'completed' | 'cancelled';
  startedAt: string;
  finishedAt: string;
  config: ExperimentConfig;
  model: { modelHash: string; stateIds: readonly StateId[]; labels: Record<StateId, string>; P: readonly (readonly number[])[]; initial: readonly number[] };
  results: {
    completed: number;
    intervalMethod: string;
    intervalLevel: number;
    endpointCounts: number[][];
    occupancy: { stateId: StateId; mean: number; se: number | null; lower: number | null; upper: number | null }[];
    hitting: null | { hitCount: number; censoredCount: number; restrictedMean: number; histogram: number[] };
    traces: { replication: number; states: StateId[] }[];
  };
}

export function buildRunBundle(chain: CompiledChain, config: ExperimentConfig, acc: Accumulator, s: ExperimentSummary,
  labels: Record<StateId, string>, startedAt: string, finishedAt: string): RunBundle {
  const n = chain.P.length;
  const finite = (v: number) => (Number.isFinite(v) ? v : null);
  return {
    format: 'markov-chain-simulator/run-bundle',
    schemaVersion: 1,
    app: { rng: RNG_ALGORITHM, trajectoryEngine: ENGINE_VERSION, experimentEngine: EXPERIMENT_ENGINE },
    status: s.partial ? 'cancelled' : 'completed',
    startedAt, finishedAt, config,
    model: { modelHash: chain.modelHash, stateIds: chain.stateIds, labels, P: chain.P, initial: config.initial ?? chain.initial },
    results: {
      completed: s.completed,
      intervalMethod: 'Wilson score (proportions), Student t over replications (means); pointwise',
      intervalLevel: 0.95,
      endpointCounts: Array.from({ length: config.horizon + 1 }, (_, t) => Array.from(acc.endpoint.subarray(t * n, t * n + n))),
      occupancy: s.occupancy.map((o) => ({
        stateId: chain.stateIds[o.state], mean: o.summary.mean, se: finite(o.summary.se),
        lower: o.summary.interval?.lower ?? null, upper: o.summary.interval?.upper ?? null,
      })),
      hitting: s.hitting && { hitCount: s.hitting.hitCount, censoredCount: s.hitting.censoredCount, restrictedMean: s.hitting.restrictedMean.mean, histogram: Array.from(acc.hitHist) },
      traces: acc.traces.map((tr) => ({ replication: tr.replication, states: tr.states.map((i) => chain.stateIds[i]) })),
    },
  };
}

/** Long-format CSV of endpoint estimates with provenance, IDs, labels, method, and sample size. */
export function experimentToCsv(chain: CompiledChain, config: ExperimentConfig, s: ExperimentSummary, labelOf: (id: StateId) => string): string {
  const rows: (string | number)[][] = [
    ['# rng', RNG_ALGORITHM], ['# engine', EXPERIMENT_ENGINE], ['# seed', config.seed], ['# replications_completed', s.completed],
    ['# replications_requested', config.replications], ['# horizon_transitions', config.horizon], ['# modelHash', chain.modelHash],
    ['# interval', '95% Wilson score, pointwise'],
    ['t', 'state_id', 'state_label', 'count', 'replications', 'estimate', 'lower95', 'upper95', 'exact'],
  ];
  s.endpoint.forEach((row, t) => row.forEach((iv, i) => {
    if (!iv) return;
    rows.push([t, chain.stateIds[i], labelOf(chain.stateIds[i]), Math.round(iv.estimate * s.completed), s.completed, iv.estimate, iv.lower, iv.upper, s.exactEndpoint[t]?.[i] ?? '']);
  }));
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}
