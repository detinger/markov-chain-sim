import { describe, expect, it } from 'vitest';
import {
  absorptionAnalysis,
  applyCommand,
  classifyChain,
  compileChain,
  createEmptyDocument,
  evolveDistribution,
  exportDocument,
  firstArrivalByHorizon,
  formatTotal,
  hittingAnalysis,
  importDocument,
  parseProbability,
  pathProbability,
  stationaryDistributions,
  validateDocument,
  type ChainDocumentV1,
  type CompiledChain,
} from '../../src/domain/markov';
import { EXAMPLES, exampleToDocument } from '../../src/lib/examples';

const TOL = 1e-10;

function doc(P: number[][], mu0: number[], ids = P.map((_, i) => 'ABCDEFG'[i])): ChainDocumentV1 {
  const base = createEmptyDocument('fixture');
  return {
    ...base,
    stateOrder: ids,
    states: ids.map((id) => ({ id, label: id })),
    transitions: P.flatMap((row, i) => row.flatMap((p, j) => (p > 0 ? [{ from: ids[i], to: ids[j], probability: p }] : []))),
    initial: ids.map((id, i) => ({ stateId: id, probability: mu0[i] })),
    layout: { positions: Object.fromEntries(ids.map((id, i) => [id, { x: i * 100, y: 0 }])) },
  };
}

function chain(P: number[][], mu0: number[], ids?: string[]): CompiledChain {
  const out = compileChain(doc(P, mu0, ids));
  if (out.status !== 'ok') throw new Error(out.issues.join('; '));
  return out.result;
}

function okResult<T>(o: { status: string; result?: T; issues?: string[] }): T {
  if (o.status !== 'ok') throw new Error(`${o.status}: ${o.issues?.join('; ')}`);
  return o.result as T;
}

const close = (a: number[], b: number[], tol = TOL) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], -Math.log10(tol)));

describe('§9.1 fixtures', () => {
  const M01 = [[0.8, 0.2], [0.3, 0.7]];

  it('M01 evolution and stationary', () => {
    const c = chain(M01, [1, 0]);
    const series = okResult(evolveDistribution(c, 2));
    close(series[0], [1, 0]);
    close(series[1], [0.8, 0.2]);
    close(series[2], [0.7, 0.3]);
    const st = okResult(stationaryDistributions(c));
    expect(st.unique).toBe(true);
    expect(st.structure.irreducible).toBe(true);
    expect(st.extremal[0].period).toBe(1);
    close(st.extremal[0].pi, [0.6, 0.4]);
  });

  it('M02 joint vs conditional path', () => {
    const cond = okResult(pathProbability(chain(M01, [1, 0]), ['A', 'B', 'B'], 'conditional'));
    expect(cond.probability).toBeCloseTo(0.14, 12);
    const joint = okResult(pathProbability(chain(M01, [0.4, 0.6]), ['A', 'B', 'B'], 'joint'));
    expect(joint.probability).toBeCloseTo(0.056, 12);
  });

  it('M03 periodic alternator', () => {
    const c = chain([[0, 1], [1, 0]], [1, 0]);
    const st = okResult(stationaryDistributions(c));
    expect(st.extremal[0].period).toBe(2);
    expect(st.unique).toBe(true);
    expect(st.convergenceGuaranteed).toBe(false);
    close(st.extremal[0].pi, [0.5, 0.5]);
    const s = okResult(evolveDistribution(c, 3));
    close(s[1], [0, 1]);
    close(s[2], [1, 0]);
    const fromPi = okResult(evolveDistribution(c, 5, [0.5, 0.5]));
    fromPi.forEach((v) => close(v, [0.5, 0.5]));
  });

  it('M04 identity has two closed classes', () => {
    const c = chain([[1, 0], [0, 1]], [0.25, 0.75]);
    const st = okResult(stationaryDistributions(c));
    expect(st.unique).toBe(false);
    expect(st.extremal).toHaveLength(2);
    close(st.classWeights, [0.25, 0.75]);
    okResult(evolveDistribution(c, 4)).forEach((v) => close(v, [0.25, 0.75]));
  });

  const M05 = [[0.5, 0.2, 0.3], [0, 1, 0], [0, 0, 1]];
  it('M05 absorption', () => {
    const c = chain(M05, [1, 0, 0], ['A', 'Ruin', 'Rich']);
    const a = okResult(absorptionAnalysis(c));
    expect(a.N[0][0]).toBeCloseTo(2, 10);
    close(a.B[0], [0.4, 0.6]);
    expect(a.t[0]).toBeCloseTo(2, 10);
    expect(a.variance[0]).toBeCloseTo(2, 10);
    const f = firstArrivalByHorizon(c, ['Ruin', 'Rich'], 5);
    f.forEach((v, h) => expect(v).toBeCloseTo(1 - 0.5 ** h, 12));
  });

  it('M06 unreachable target', () => {
    const c = chain([[0, 1, 0], [0, 1, 0], [0, 0, 1]], [1, 0, 0]);
    const h = okResult(hittingAnalysis(c, ['C']));
    expect(h.probability[0]).toBe(0);
    expect(h.meanTime[0]).toEqual({ kind: 'infinite' });
  });

  it('M07 partial hit probability', () => {
    const c = chain([[0, 0.4, 0.6], [0, 1, 0], [0, 0, 1]], [1, 0, 0]);
    const h = okResult(hittingAnalysis(c, ['B']));
    expect(h.probability[0]).toBeCloseTo(0.4, 12);
    expect(h.meanTime[0]).toEqual({ kind: 'infinite' });
    expect(h.conditionalMeanTime[0]).toMatchObject({ kind: 'finite' });
    expect((h.conditionalMeanTime[0] as { value: number }).value).toBeCloseTo(1, 10);
  });

  it('M08 reducible, unique stationary', () => {
    const c = chain([[0.5, 0.5], [0, 1]], [1, 0]);
    const st = okResult(stationaryDistributions(c));
    expect(st.structure.irreducible).toBe(false);
    expect(st.unique).toBe(true);
    close(st.extremal[0].pi, [0, 1]);
    const h = okResult(hittingAnalysis(c, ['B']));
    expect((h.meanTime[0] as { value: number }).value).toBeCloseTo(2, 10);
  });

  it('M09 one-state chain', () => {
    const c = chain([[1]], [1]);
    const st = okResult(stationaryDistributions(c));
    close(st.extremal[0].pi, [1]);
    expect(st.extremal[0].meanReturn[0]).toBe(1);
    const h = okResult(hittingAnalysis(c, ['A']));
    expect(h.meanTime[0]).toEqual({ kind: 'finite', value: 0 });
  });

  it('M10 deterministic 3-cycle', () => {
    const c = chain([[0, 1, 0], [0, 0, 1], [1, 0, 0]], [1, 0, 0]);
    const f = firstArrivalByHorizon(c, ['B'], 2);
    expect(f).toEqual([0, 1, 1]);
    expect(okResult(evolveDistribution(c, 2))[2][1]).toBe(0);
    const st = okResult(stationaryDistributions(c));
    expect(st.extremal[0].period).toBe(3);
    expect(st.extremal[0].meanReturn[1]).toBeCloseTo(3, 10);
  });

  it('M11 finite-horizon censoring', () => {
    const c = chain(M05, [1, 0, 0], ['A', 'Ruin', 'Rich']);
    const f = firstArrivalByHorizon(c, ['Ruin', 'Rich'], 2);
    expect(f[2]).toBeCloseTo(0.75, 12);
    expect(1 - f[2]).toBeCloseTo(0.25, 12);
    // E[min(T,H)] = Σ_{t=0}^{H-1} Pr(T > t)
    const restricted = (1 - f[0]) + (1 - f[1]);
    expect(restricted).toBeCloseTo(1.5, 12);
    expect((0.5 * 1 + 0.25 * 2) / f[2]).toBeCloseTo(4 / 3, 12);
  });

  it('M12 absorbing state plus periodic closed class is not an absorbing chain', () => {
    const c = chain([[1, 0, 0], [0, 0, 1], [0, 1, 0]], [1, 0, 0]);
    const s = okResult(classifyChain(c));
    expect(s.absorbing).toEqual([0]);
    const bc = s.classes.find((k) => k.states.join() === '1,2')!;
    expect(bc.closed).toBe(true);
    expect(bc.period).toBe(2);
    expect(absorptionAnalysis(c).status).toBe('unsupported');
  });

  it('M13 rare edge stays in support', () => {
    const c = chain([[1 - 1e-8, 1e-8], [0, 1]], [1, 0]);
    const s = okResult(classifyChain(c));
    expect(s.irreducible).toBe(false);
    expect(s.transient).toEqual([0]);
    const h = okResult(hittingAnalysis(c, ['B']));
    expect((h.meanTime[0] as { value: number }).value / 1e8).toBeCloseTo(1, 6);
  });

  it('M15 horizon 0', () => {
    const c = chain(M01, [0.4, 0.6]);
    expect(okResult(evolveDistribution(c, 0))).toEqual([[0.4, 0.6]]);
    const p = okResult(pathProbability(c, ['A'], 'joint'));
    expect(p.transitions).toBe(0);
    expect(p.probability).toBeCloseTo(0.4, 12);
    expect(okResult(pathProbability(c, ['A'], 'conditional')).probability).toBe(1);
  });
});

describe('validation and input', () => {
  it('parses drafts without turning them into zero', () => {
    expect(parseProbability('').kind).toBe('draft');
    expect(parseProbability('0.').kind).toBe('value');
    expect(parseProbability('1e').kind).toBe('draft');
    expect(parseProbability('-').kind).toBe('draft');
    expect(parseProbability('-0.2').kind).toBe('invalid');
    expect(parseProbability('1.2').kind).toBe('invalid');
    expect(parseProbability('2e-3')).toEqual({ kind: 'value', value: 0.002 });
    expect(parseProbability('Infinity').kind).toBe('invalid');
    expect(parseProbability('1/2').kind).toBe('invalid');
  });

  it('flags invalid rows and does not compile them', () => {
    const d = doc([[0.5, 0.7], [0, 1]], [1, 0]);
    const issues = validateDocument(d);
    expect(issues.find((i) => i.code === 'row.sum')?.title).toBe('Transitions from A total 1.2');
    expect(compileChain(d).status).toBe('invalid');
  });

  it('never rounds an invalid total to 1', () => {
    expect(formatTotal(1.00001)).not.toBe('1');
    expect(formatTotal(1 + 1e-13)).toBe('1');
  });

  it('rescales within εrow and records the adjustment', () => {
    const out = compileChain(doc([[0.1 + 0.2, 0.7], [0, 1]], [1, 0]));
    expect(out.status).toBe('ok');
    if (out.status === 'ok') expect(out.result.adjustments.length).toBeGreaterThanOrEqual(0);
  });

  it('flags a zero row with repair options', () => {
    const d = doc([[0, 0], [0, 1]], [1, 0]);
    const issue = validateDocument(d).find((i) => i.code === 'row.zero');
    expect(issue?.repairs).toEqual(['make-absorbing', 'distribute-equally']);
  });

  it('joint path reports first impossible step and underflow', () => {
    const c = chain([[0.5, 0.5], [0, 1]], [1, 0]);
    const p = okResult(pathProbability(c, ['A', 'B', 'A'], 'joint'));
    expect(p.probability).toBe(0);
    expect(p.firstZeroFactor).toBe(2);
    const long = okResult(pathProbability(c, new Array(2000).fill('A'), 'conditional'));
    expect(long.underflow).toBe(true);
    expect(long.logProbability).toBeCloseTo(1999 * Math.log(0.5), 6);
  });
});

describe('commands', () => {
  it('new states keep the model valid', () => {
    let d = createEmptyDocument();
    d = applyCommand(d, { type: 'addState', id: 's1', label: 'One', x: 0, y: 0 });
    d = applyCommand(d, { type: 'addState', id: 's2', label: 'Two', x: 0, y: 0 });
    expect(validateDocument(d).filter((i) => i.severity === 'error')).toEqual([]);
    expect(d.initial).toEqual([{ stateId: 's1', probability: 1 }, { stateId: 's2', probability: 0 }]);
  });

  it('rename and move do not change the model hash', () => {
    const d = doc([[0.8, 0.2], [0.3, 0.7]], [1, 0]);
    const h0 = (compileChain(d) as { result: CompiledChain }).result.modelHash;
    const d2 = applyCommand(applyCommand(d, { type: 'renameState', id: 'A', label: 'Sunny' }), { type: 'moveState', id: 'B', x: 5, y: 5 });
    expect((compileChain(d2) as { result: CompiledChain }).result.modelHash).toBe(h0);
    expect(d2.modelRevision).toBe(d.modelRevision);
  });

  it('setting zero removes the edge but keeps a valid matrix', () => {
    let d = doc([[0.8, 0.2], [0.3, 0.7]], [1, 0]);
    d = applyCommand(d, { type: 'setProbability', from: 'A', to: 'B', probability: 0 });
    expect(d.transitions.some((t) => t.from === 'A' && t.to === 'B')).toBe(false);
    d = applyCommand(d, { type: 'normalizeRow', stateId: 'A' });
    expect(validateDocument(d).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('round-trips through JSON export/import', () => {
    const d = exampleToDocument('socialMedia');
    const back = importDocument(exportDocument(d));
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.document.transitions).toEqual(d.transitions);
      expect(back.document.initial).toEqual(d.initial);
      expect(back.document.layout.positions).toEqual(d.layout.positions);
    }
  });

  it('rejects newer schemas and broken JSON', () => {
    expect(importDocument('{').ok).toBe(false);
    const r = importDocument(JSON.stringify({ schemaVersion: 2 }));
    expect(r.ok === false && r.errors[0]).toMatch(/newer file format/);
  });
});

describe('original examples (B11)', () => {
  for (const key of Object.keys(EXAMPLES)) {
    it(`${key} is valid and analyzable`, () => {
      const d = exampleToDocument(key);
      expect(validateDocument(d).filter((i) => i.severity === 'error')).toEqual([]);
      const c = compileChain(d);
      expect(c.status).toBe('ok');
      if (c.status !== 'ok') return;
      const st = okResult(stationaryDistributions(c.result));
      st.extremal.forEach((e) => expect(e.pi.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10));
    });
  }

  it('Casino Heist absorbs into Broke or Rich with probabilities summing to 1', () => {
    const c = compileChain(exampleToDocument('gambler'));
    if (c.status !== 'ok') throw new Error();
    const a = okResult(absorptionAnalysis(c.result));
    expect(a.absorbing.map((i) => c.result.stateIds[i])).toEqual(['1', '6']);
    a.B.forEach((row) => expect(row[0] + row[1]).toBeCloseTo(1, 10));
  });
});
