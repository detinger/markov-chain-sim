import { describe, expect, it } from 'vitest';
import { compileChain, createEmptyDocument, type ChainDocumentV1, type CompiledChain } from '../../src/domain/markov';
import {
  buildRunBundle, emptyAccumulator, mergeAccumulators, runReplications, simulateTrajectory, summarizeExperiment,
  validateExperimentConfig, type ExperimentConfig,
} from '../../src/domain/simulation';
import { meanInterval, normalQuantile, studentTCdf, studentTQuantile, wilson } from '../../src/domain/statistics';

function chain(P: number[][], mu0: number[], ids = P.map((_, i) => 'ABCDEFG'[i])): CompiledChain {
  const d: ChainDocumentV1 = {
    ...createEmptyDocument('t'),
    stateOrder: ids,
    states: ids.map((id) => ({ id, label: id })),
    transitions: P.flatMap((row, i) => row.flatMap((p, j) => (p > 0 ? [{ from: ids[i], to: ids[j], probability: p }] : []))),
    initial: ids.map((id, i) => ({ stateId: id, probability: mu0[i] })),
  };
  const out = compileChain(d);
  if (out.status !== 'ok') throw new Error(out.issues.join());
  return out.result;
}

const cfg = (c: CompiledChain, patch: Partial<ExperimentConfig> = {}): ExperimentConfig => ({
  schemaVersion: 1, modelHash: c.modelHash, seed: 2024, replications: 2000, horizon: 20, targetIds: [], burnIn: 0, traceLimit: 3, ...patch,
});

describe('interval estimators', () => {
  it('Wilson handles 0/M, M/M, and M = 1', () => {
    const zero = wilson(0, 100)!;
    expect(zero.estimate).toBe(0);
    expect(zero.lower).toBe(0);
    expect(zero.upper).toBeCloseTo(0.03699, 4); // zero events never imply zero probability
    const all = wilson(100, 100)!;
    expect(all.upper).toBe(1);
    expect(all.lower).toBeCloseTo(0.96301, 4);
    const one = wilson(1, 1)!;
    expect(one.lower).toBeCloseTo(0.20654, 4);
    expect(wilson(0, 0)).toBeNull();
    const mid = wilson(40, 100)!;
    expect(mid.lower).toBeCloseTo(0.30941, 4);
    expect(mid.upper).toBeCloseTo(0.49800, 4);
  });

  it('Student t quantiles match tables', () => {
    expect(studentTQuantile(0.975, 1)).toBeCloseTo(12.7062, 3);
    expect(studentTQuantile(0.975, 10)).toBeCloseTo(2.2281, 3);
    expect(studentTQuantile(0.975, 1000)).toBeCloseTo(1.9623, 3);
    expect(studentTCdf(0, 5)).toBeCloseTo(0.5, 12);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 6);
  });

  it('mean interval needs at least two replications', () => {
    expect(meanInterval(3, 9, 1).interval).toBeNull();
    const s = meanInterval(10, 30, 5); // values with mean 2, Σx² = 30 → var = (30 − 20)/4 = 2.5
    expect(s.mean).toBe(2);
    expect(s.sd).toBeCloseTo(Math.sqrt(2.5), 12);
    expect(s.df).toBe(4);
    expect(s.interval!.upper - s.mean).toBeCloseTo(2.7764 * Math.sqrt(2.5 / 5), 3);
  });
});

describe('experiment engine', () => {
  const weather = chain([[0.8, 0.2], [0.4, 0.6]], [1, 0]);

  it('replication 0 reproduces the animated trajectory with the same seed (shared draw contract)', () => {
    const c = cfg(weather, { replications: 1, horizon: 50, traceLimit: 1 });
    const acc = runReplications(weather, c, 0, 1);
    const anim = simulateTrajectory(weather, { seed: c.seed, stream: 0, horizon: 50, stopOnAbsorption: false });
    expect(acc.traces[0].states).toEqual(anim.events.map((e) => e.to));
  });

  it('is independent of batching (worker-count equivalence)', () => {
    const c = cfg(weather, { targetIds: ['B'] });
    const whole = runReplications(weather, c, 0, 2000);
    const parts = [[0, 1], [1, 700], [700, 1500], [1500, 2000]].map(([a, b]) => runReplications(weather, c, a, b));
    const merged = parts.reduce(mergeAccumulators, emptyAccumulator(2, c.horizon));
    expect(Array.from(merged.endpoint)).toEqual(Array.from(whole.endpoint));
    expect(Array.from(merged.hitHist)).toEqual(Array.from(whole.hitHist));
    expect(merged.hitCount).toBe(whole.hitCount);
    expect(merged.restrictedSum).toBe(whole.restrictedSum);
    merged.occSum.forEach((v, i) => expect(v).toBeCloseTo(whole.occSum[i], 9));
    expect(merged.traces.map((t) => t.replication)).toEqual([0, 1, 2]);
  });

  it('counts H+1 observations per replication and conserves mass at each t', () => {
    const c = cfg(weather, { replications: 500, horizon: 7 });
    const acc = runReplications(weather, c, 0, 500);
    for (let t = 0; t <= 7; t++) expect(acc.endpoint[t * 2] + acc.endpoint[t * 2 + 1]).toBe(500);
    const s = summarizeExperiment(weather, c, acc);
    expect(s.occupancyWindow).toEqual({ from: 0, to: 7, observations: 8 });
    expect(s.occupancy[0].summary.mean + s.occupancy[1].summary.mean).toBeCloseTo(1, 12);
  });

  it('estimates agree with exact values (predeclared seeds, 5·SE tolerance)', () => {
    for (const seed of [1, 2, 3]) {
      const c = cfg(weather, { seed, replications: 4000, horizon: 10, targetIds: ['B'] });
      const s = summarizeExperiment(weather, c, runReplications(weather, c, 0, c.replications));
      for (const t of [1, 2, 10]) {
        const est = s.endpoint[t][0]!.estimate;
        const exact = s.exactEndpoint[t][0];
        expect(Math.abs(est - exact)).toBeLessThan(5 * Math.sqrt((exact * (1 - exact)) / c.replications));
      }
      const h = s.hitting!;
      expect(Math.abs(h.hitByHorizon!.estimate - h.exactHitByHorizon)).toBeLessThan(0.02);
      expect(Math.abs(h.restrictedMean.mean - h.exactRestrictedMean)).toBeLessThan(5 * h.restrictedMean.se);
    }
  });

  it('M11: censoring, restricted mean, and conditional mean among hits', () => {
    const m05 = chain([[0.5, 0.2, 0.3], [0, 1, 0], [0, 0, 1]], [1, 0, 0], ['A', 'Ruin', 'Rich']);
    const c = cfg(m05, { replications: 20000, horizon: 2, targetIds: ['Ruin', 'Rich'] });
    const s = summarizeExperiment(m05, c, runReplications(m05, c, 0, c.replications));
    const h = s.hitting!;
    expect(h.exactHitByHorizon).toBeCloseTo(0.75, 12);
    expect(h.exactRestrictedMean).toBeCloseTo(1.5, 12);
    expect(h.hitCount + h.censoredCount).toBe(20000);
    expect(Math.abs(h.censoredCount / 20000 - 0.25)).toBeLessThan(0.015);
    expect(Math.abs(h.meanAmongHits! - 4 / 3)).toBeLessThan(0.02);
    expect(h.histogram[0].count).toBe(0);
    expect(h.histogram.map((b) => b.exact)).toEqual([0, 0.5, 0.25]);
  });

  it('target occupied at t = 0 is a hit at time 0', () => {
    const c = cfg(weather, { replications: 50, horizon: 5, targetIds: ['A'] });
    const s = summarizeExperiment(weather, c, runReplications(weather, c, 0, 50));
    expect(s.hitting!.histogram[0].count).toBe(50);
    expect(s.hitting!.restrictedMean.mean).toBe(0);
  });

  it('burn-in changes only occupancy, never first hits', () => {
    const base = cfg(weather, { replications: 300, horizon: 30, targetIds: ['B'] });
    const a = runReplications(weather, base, 0, 300);
    const b = runReplications(weather, { ...base, burnIn: 10 }, 0, 300);
    expect(Array.from(b.hitHist)).toEqual(Array.from(a.hitHist));
    const s = summarizeExperiment(weather, { ...base, burnIn: 10 }, b);
    expect(s.occupancyWindow.observations).toBe(21);
  });

  it('H = 0 samples endpoints from μ₀ only', () => {
    const c0 = chain([[0.8, 0.2], [0.4, 0.6]], [0.25, 0.75]);
    const c = cfg(c0, { replications: 8000, horizon: 0 });
    const s = summarizeExperiment(c0, c, runReplications(c0, c, 0, 8000));
    expect(s.endpoint).toHaveLength(1);
    expect(Math.abs(s.endpoint[0][0]!.estimate - 0.25)).toBeLessThan(0.025);
  });

  it('labels partial (cancelled) results and validates configs', () => {
    const c = cfg(weather, { replications: 1000 });
    const s = summarizeExperiment(weather, c, runReplications(weather, c, 0, 250));
    expect(s.partial).toBe(true);
    expect(s.completed).toBe(250);
    expect(validateExperimentConfig(weather, { ...c, burnIn: 99 })).toContain('Burn-in must satisfy 0 ≤ b ≤ H.');
    expect(validateExperimentConfig(weather, { ...c, modelHash: 'x' })).toHaveLength(1);
  });

  it('builds a JSON-safe run bundle with provenance', () => {
    const c = cfg(weather, { replications: 1, targetIds: ['B'] });
    const acc = runReplications(weather, c, 0, 1);
    const s = summarizeExperiment(weather, c, acc);
    const b = buildRunBundle(weather, c, acc, s, { A: 'Sunny', B: 'Rainy' }, 't0', 't1');
    const json = JSON.stringify(b);
    expect(json).not.toMatch(/NaN|Infinity/);
    expect(b.app.rng).toBe('markov-ctr32x2-v1');
    expect(b.results.occupancy[0].se).toBeNull(); // M = 1: no interval
  });
});
