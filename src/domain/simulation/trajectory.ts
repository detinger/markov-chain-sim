import { compensatedSum } from '../markov/numeric';
import type { CompiledChain, StateId } from '../markov/types';
import { RNG_ALGORITHM, streamKey, uniformFromKey } from './rng';

export const ENGINE_VERSION = 'trajectory-v1';

/** Cumulative table over strictly positive entries, in canonical order. Last bound is exactly 1. */
export interface CdfRow {
  targets: number[];
  probabilities: number[];
  /** bounds[k] = upper end of targets[k]'s interval; lower end is bounds[k−1] (or 0). */
  bounds: number[];
}

export function buildCdfRow(row: readonly number[]): CdfRow {
  const targets: number[] = [];
  const probabilities: number[] = [];
  row.forEach((p, j) => { if (p > 0) { targets.push(j); probabilities.push(p); } });
  const bounds = probabilities.map((_, k) => compensatedSum(probabilities.slice(0, k + 1)));
  // Valid compiled rows only: correct the final boundary so u just below 1 is always covered.
  if (bounds.length) bounds[bounds.length - 1] = 1;
  return { targets, probabilities, bounds };
}

export function buildCdfTable(chain: CompiledChain): CdfRow[] {
  return chain.P.map(buildCdfRow);
}

/** Index into `row.targets` of the first bound strictly greater than u. */
export function sampleSlot(row: CdfRow, u: number): number {
  let lo = 0;
  let hi = row.bounds.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (row.bounds[mid] > u) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export interface TransitionEvent {
  step: number;
  /** null for the initial draw at t = 0. */
  from: number | null;
  to: number;
  /** Probability of the chosen outcome (μ₀[to] at t = 0, P[from][to] afterwards). */
  probability: number;
  /** The uniform draw used. */
  u: number;
  /** The CDF interval [lo, hi) that contained u. */
  interval: [number, number];
}

export interface TrajectoryConfig {
  seed: number;
  stream: number;
  horizon: number;
  /** Optional start-distribution override (same order as chain.stateIds); defaults to chain.initial. */
  initial?: readonly number[];
  stopOnAbsorption: boolean;
}

export interface Trajectory {
  config: TrajectoryConfig;
  modelHash: string;
  stateIds: readonly StateId[];
  rng: typeof RNG_ALGORITHM;
  engine: typeof ENGINE_VERSION;
  events: TransitionEvent[];
  endReason: 'horizon' | 'absorbed';
}

function drawFrom(row: CdfRow, u: number, from: number | null, step: number): TransitionEvent {
  const k = sampleSlot(row, u);
  return { step, from, to: row.targets[k], probability: row.probabilities[k], u, interval: [k ? row.bounds[k - 1] : 0, row.bounds[k]] };
}

/** One transition from `from` at time `step` (draw counter = step). Pure and replayable. */
export function stepTrajectory(cdf: CdfRow[], from: number, key: number, step: number): TransitionEvent {
  return drawFrom(cdf[from], uniformFromKey(key, step), from, step);
}

export function simulateTrajectory(chain: CompiledChain, config: TrajectoryConfig, cdf = buildCdfTable(chain)): Trajectory {
  const key = streamKey(config.seed, config.stream);
  const initialRow = buildCdfRow(config.initial ?? chain.initial);
  const absorbing = chain.P.map((row, i) => row[i] === 1);
  const events: TransitionEvent[] = [drawFrom(initialRow, uniformFromKey(key, 0), null, 0)];
  let endReason: Trajectory['endReason'] = 'horizon';
  for (let t = 1; t <= config.horizon; t++) {
    const current = events[t - 1].to;
    if (config.stopOnAbsorption && absorbing[current]) { endReason = 'absorbed'; break; }
    events.push(stepTrajectory(cdf, current, key, t));
  }
  return { config, modelHash: chain.modelHash, stateIds: chain.stateIds, rng: RNG_ALGORITHM, engine: ENGINE_VERSION, events, endReason };
}

const FORMULA_START = /^[=+\-@\t\r]/;
/** CSV cell with quoting and spreadsheet-formula neutralization for text. */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (typeof v === 'string' && FORMULA_START.test(s)) s = `'${s}`; // neutralize spreadsheet formulas
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Trace CSV with provenance header rows. */
export function trajectoryToCsv(traj: Trajectory, labelOf: (id: StateId) => string): string {
  const id = (i: number | null) => (i === null ? '' : traj.stateIds[i]);
  const name = (i: number | null) => (i === null ? '' : labelOf(traj.stateIds[i]));
  const lines = [
    ['# rng', traj.rng], ['# engine', traj.engine], ['# seed', traj.config.seed], ['# stream', traj.config.stream],
    ['# horizon', traj.config.horizon], ['# stopOnAbsorption', String(traj.config.stopOnAbsorption)], ['# modelHash', traj.modelHash],
    ['step', 'from_id', 'from_label', 'to_id', 'to_label', 'probability', 'u', 'interval_lo', 'interval_hi'],
    ...traj.events.map((e) => [e.step, id(e.from), name(e.from), id(e.to), name(e.to), e.probability, e.u, e.interval[0], e.interval[1]]),
  ];
  return lines.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}
