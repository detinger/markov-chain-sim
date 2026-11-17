import { describe, expect, it } from 'vitest';
import { compileChain, createEmptyDocument, type ChainDocumentV1, type CompiledChain } from '../../src/domain/markov';
import {
  buildCdfRow, buildCdfTable, mix32, parseSeed, RNG_ALGORITHM, sampleSlot, simulateTrajectory, stepTrajectory,
  streamKey, trajectoryToCsv, uniform,
} from '../../src/domain/simulation';

function chain(P: number[][], mu0: number[]): CompiledChain {
  const ids = P.map((_, i) => 'ABCDEFG'[i]);
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

describe(`RNG ${RNG_ALGORITHM}`, () => {
  it('matches the published reference vectors', () => {
    expect(RNG_ALGORITHM).toBe('markov-ctr32x2-v1');
    expect([0, 1, 0xdeadbeef].map(mix32)).toEqual([0, 1753845952, 3861431939]);
    expect(uniform(0, 0, 0)).toBe(0.6725762380102092);
    expect(uniform(0, 0, 1)).toBe(0.09252685878646161);
    expect(uniform(42, 0, 0)).toBe(0.42127514289089174);
    expect(uniform(42, 7, 3)).toBe(0.26367515989847157);
    expect(uniform(4294967295, 4294967295, 1000000)).toBe(0.5635306098258269);
  });

  it('stays in [0, 1) and is roughly uniform (fixed-seed smoke test)', () => {
    const N = 200_000;
    const buckets = new Array(20).fill(0);
    let sum = 0;
    for (let c = 0; c < N; c++) {
      const u = uniform(12345, 0, c);
      expect(u >= 0 && u < 1).toBe(true);
      if (c < 10) expect(u).toBe(uniform(12345, 0, c)); // stateless
      sum += u;
      buckets[Math.floor(u * 20)]++;
    }
    expect(sum / N).toBeGreaterThan(0.497);
    expect(sum / N).toBeLessThan(0.503);
    const expected = N / 20;
    const chi2 = buckets.reduce((s, b) => s + (b - expected) ** 2 / expected, 0);
    expect(chi2).toBeLessThan(43.8); // χ²₁₉ 0.999 quantile
  });

  it('separates streams and seeds', () => {
    const a = Array.from({ length: 50 }, (_, c) => uniform(7, 0, c));
    const b = Array.from({ length: 50 }, (_, c) => uniform(7, 1, c));
    const d = Array.from({ length: 50 }, (_, c) => uniform(8, 0, c));
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(d);
  });

  it('parses seeds strictly', () => {
    expect(parseSeed('42')).toBe(42);
    expect(parseSeed('4294967295')).toBe(4294967295);
    expect(parseSeed('4294967296')).toBeNull();
    expect(parseSeed('-1')).toBeNull();
    expect(parseSeed('1.5')).toBeNull();
    expect(parseSeed('')).toBeNull();
  });
});

describe('categorical sampler boundaries', () => {
  const row = buildCdfRow([0, 0.25, 0, 0.75, 0]);
  it('excludes zero entries and closes the CDF at exactly 1', () => {
    expect(row.targets).toEqual([1, 3]);
    expect(row.bounds).toEqual([0.25, 1]);
  });
  it('u = 0 selects the first positive destination', () => expect(row.targets[sampleSlot(row, 0)]).toBe(1));
  it('u on a boundary selects the next destination (strictly greater rule)', () => expect(row.targets[sampleSlot(row, 0.25)]).toBe(3));
  it('u just below 1 selects the last positive destination', () => expect(row.targets[sampleSlot(row, 1 - Number.EPSILON / 2)]).toBe(3));
  it('a rounding-short row still covers u just below 1', () => {
    const r = buildCdfRow([0.1, 0.2, 0.7 - 1e-15]);
    expect(r.bounds[2]).toBe(1);
    expect(r.targets[sampleSlot(r, 0.9999999999999999)]).toBe(2);
  });
  it('never selects zero-probability entries across many draws', () => {
    for (let c = 0; c < 5000; c++) expect([1, 3]).toContain(row.targets[sampleSlot(row, uniform(3, 0, c))]);
  });
});

describe('trajectory engine', () => {
  const weather = chain([[0.8, 0.2], [0.4, 0.6]], [1, 0]);

  it('horizon H gives H transitions and H+1 states, starting from μ₀', () => {
    const t = simulateTrajectory(weather, { seed: 1, stream: 0, horizon: 10, stopOnAbsorption: false });
    expect(t.events).toHaveLength(11);
    expect(t.events[0]).toMatchObject({ step: 0, from: null, to: 0, probability: 1 });
    t.events.slice(1).forEach((e, i) => {
      expect(e.step).toBe(i + 1);
      expect(e.from).toBe(t.events[i].to);
      expect(e.probability).toBe(weather.P[e.from!][e.to]);
      expect(e.u >= e.interval[0] && e.u < e.interval[1]).toBe(true);
    });
  });

  it('H = 0 only samples X₀ from μ₀', () => {
    const c = chain([[0.8, 0.2], [0.4, 0.6]], [0.3, 0.7]);
    const t = simulateTrajectory(c, { seed: 9, stream: 0, horizon: 0, stopOnAbsorption: false });
    expect(t.events).toHaveLength(1);
    expect(t.events[0].to).toBe(uniform(9, 0, 0) < 0.3 ? 0 : 1);
  });

  it('is identical whether run at once, stepped, or replayed (seed replay)', () => {
    const cfg = { seed: 2024, stream: 0, horizon: 500, stopOnAbsorption: false };
    const once = simulateTrajectory(weather, cfg);
    const again = simulateTrajectory(weather, cfg);
    expect(again.events).toEqual(once.events);
    const cdf = buildCdfTable(weather);
    const key = streamKey(cfg.seed, cfg.stream);
    let state = once.events[0].to;
    for (let t = 1; t <= cfg.horizon; t++) {
      const e = stepTrajectory(cdf, state, key, t);
      expect(e).toEqual(once.events[t]);
      state = e.to;
    }
    // A shorter horizon is a prefix of a longer one (no hidden RNG state).
    const short = simulateTrajectory(weather, { ...cfg, horizon: 50 });
    expect(short.events).toEqual(once.events.slice(0, 51));
  });

  it('different seeds give different paths', () => {
    const a = simulateTrajectory(weather, { seed: 1, stream: 0, horizon: 100, stopOnAbsorption: false });
    const b = simulateTrajectory(weather, { seed: 2, stream: 0, horizon: 100, stopOnAbsorption: false });
    expect(a.events.map((e) => e.to)).not.toEqual(b.events.map((e) => e.to));
  });

  it('deterministic rows always move to their only destination', () => {
    const cyc = chain([[0, 1, 0], [0, 0, 1], [1, 0, 0]], [1, 0, 0]);
    const t = simulateTrajectory(cyc, { seed: 5, stream: 0, horizon: 9, stopOnAbsorption: false });
    expect(t.events.map((e) => e.to)).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2, 0]);
  });

  it('absorption stop ends at the first absorbing state, including t = 0', () => {
    const m05 = chain([[0.5, 0.2, 0.3], [0, 1, 0], [0, 0, 1]], [1, 0, 0]);
    const t = simulateTrajectory(m05, { seed: 11, stream: 0, horizon: 1000, stopOnAbsorption: true });
    expect(t.endReason).toBe('absorbed');
    const last = t.events[t.events.length - 1].to;
    expect([1, 2]).toContain(last);
    expect(t.events.slice(0, -1).every((e) => e.to === 0)).toBe(true);
    const startAbsorbed = simulateTrajectory(m05, { seed: 11, stream: 0, horizon: 10, stopOnAbsorption: true, initial: [0, 1, 0] });
    expect(startAbsorbed.events).toHaveLength(1);
    expect(startAbsorbed.endReason).toBe('absorbed');
    const noStop = simulateTrajectory(m05, { seed: 11, stream: 0, horizon: 30, stopOnAbsorption: false });
    expect(noStop.events).toHaveLength(31);
  });

  it('long-run visit frequency is near π for a fixed seed (calibrated tolerance)', () => {
    const t = simulateTrajectory(weather, { seed: 77, stream: 0, horizon: 100_000, stopOnAbsorption: false });
    const frac = t.events.filter((e) => e.to === 0).length / t.events.length;
    expect(Math.abs(frac - 2 / 3)).toBeLessThan(0.01);
  });

  it('exports CSV with provenance and neutralized formulas', () => {
    const t = simulateTrajectory(weather, { seed: 1, stream: 0, horizon: 30, stopOnAbsorption: false });
    expect(t.events.some((e) => e.to === 1)).toBe(true);
    const csv = trajectoryToCsv(t, (id) => (id === 'A' ? '=HYPERLINK("x")' : 'Rainy, wet'));
    expect(csv).toContain('# rng,markov-ctr32x2-v1');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"Rainy, wet"');
    expect(csv.trim().split('\n')).toHaveLength(8 + 31);
  });
});
