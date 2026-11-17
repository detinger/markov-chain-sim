import { describe, expect, it } from 'vitest';
import { assessChallenge, evaluateTarget, parseAnswer, snapshotToDocument, suggestRoles, type ModelSnapshot, type Submission } from '../../src/domain/assessment';
import { absorptionAnalysis, classifyChain, compileChain, stationaryDistributions, structuralIssues, validateDocument } from '../../src/domain/markov';
import { CHALLENGES } from '../../src/data/challenges';
import { LESSONS, LESSON_BY_ID, ISSUE_LESSONS } from '../../src/data/lessons';
import { exampleToDocument } from '../../src/lib/examples';

const valid = (s: ModelSnapshot) => validateDocument(snapshotToDocument(s)).filter((i) => i.severity === 'error');

describe('lesson fixtures', () => {
  it('have unique stable IDs, valid prerequisites, and resolvable next steps', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of LESSONS) {
      l.prerequisites.forEach((p) => expect(LESSON_BY_ID[p]).toBeDefined());
      if (l.next) expect(LESSON_BY_ID[l.next]).toBeDefined();
      expect(l.version).toBeGreaterThanOrEqual(1);
      expect(l.objective.length).toBeGreaterThan(10);
    }
    Object.values(ISSUE_LESSONS).forEach((id) => expect(LESSON_BY_ID[id]).toBeDefined());
  });

  it('cover levels 1–5 with a mistake and a knowledge check in every lesson', () => {
    expect(new Set(LESSONS.map((l) => l.level))).toEqual(new Set([1, 2, 3, 4, 5]));
    for (const l of LESSONS) {
      expect(l.sections.some((s) => s.kind === 'mistake')).toBe(true);
      expect(l.sections.some((s) => s.kind === 'check' || s.kind === 'numeric-check')).toBe(true);
    }
  });

  it('use only valid models', () => {
    for (const l of LESSONS) for (const s of l.sections) {
      if ('snapshot' in s) expect(valid(s.snapshot), `${l.id}`).toEqual([]);
    }
  });

  it('numeric checks are computable and match their worked explanations', () => {
    const expected: Record<string, number> = {
      'evolution.one-step/q1': 0.4, 'evolution.n-step/q1': 0.28, 'evolution.paths/q1': 0.12,
    };
    for (const l of LESSONS) for (const s of l.sections) {
      if (s.kind !== 'numeric-check') continue;
      const v = evaluateTarget(s.snapshot, s.target);
      expect(v).not.toBeNull();
      expect(v!).toBeCloseTo(expected[`${l.id}/${s.id}`], 12);
    }
  });

  it('multiple-choice answers agree with the mathematics', () => {
    const choice = (id: string, q = 'q1') => {
      const s = LESSON_BY_ID[id].sections.find((x) => x.kind === 'check' && x.id === q);
      if (s?.kind !== 'check') throw new Error(id);
      return s.choices[s.correct];
    };
    expect(choice('foundations.states')).toMatch(/^0\.2/);
    expect(choice('foundations.rows')).toBe('0.2');
    // Classes lesson: A is the only transient state.
    const classes = LESSON_BY_ID['longrun.classes'].sections.find((s) => s.kind === 'model');
    if (classes?.kind !== 'model') throw new Error();
    const c = compileChain(snapshotToDocument(classes.snapshot));
    if (c.status !== 'ok') throw new Error();
    const st = classifyChain(c.result);
    expect(st.status === 'ok' && st.result.transient).toEqual([0]);
    expect(choice('longrun.classes')).toBe('A');
    // Alternator: unique π = [0.5, 0.5], no convergence guarantee.
    const alt = LESSON_BY_ID['longrun.stationary'].sections.find((s) => s.kind === 'demo-evolve');
    if (alt?.kind !== 'demo-evolve') throw new Error();
    const ac = compileChain(snapshotToDocument(alt.snapshot));
    if (ac.status !== 'ok') throw new Error();
    const sd = stationaryDistributions(ac.result);
    expect(sd.status === 'ok' && sd.result.convergenceGuaranteed).toBe(false);
    expect(choice('longrun.stationary')).toMatch(/does not converge/);
    // Absorption: Pr(Rich) = 0.6.
    const g = LESSON_BY_ID['absorption.outcomes'].sections.find((s) => s.kind === 'model');
    if (g?.kind !== 'model') throw new Error();
    const gc = compileChain(snapshotToDocument(g.snapshot));
    if (gc.status !== 'ok') throw new Error();
    const ab = absorptionAnalysis(gc.result);
    expect(ab.status === 'ok' && ab.result.B[0][1]).toBeCloseTo(0.6, 12);
    expect(choice('absorption.outcomes')).toBe('0.6');
  });
});

describe('challenges', () => {
  const submissionFor = (id: string): Submission => {
    const def = CHALLENGES.find((c) => c.id === id)!;
    return {
      snapshot: def.reference.snapshot ?? def.starter,
      roleMap: def.reference.roleMap ?? {},
      answers: Object.fromEntries(Object.entries(def.reference.answers ?? {}).map(([k, v]) => [k, String(v)])),
    };
  };

  it('have unique IDs, known prerequisites, and three progressive hints', () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    for (const c of CHALLENGES) {
      c.prerequisites.forEach((p) => expect(LESSON_BY_ID[p]).toBeDefined());
      expect(c.hints.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('reference solutions pass', () => {
    for (const c of CHALLENGES) {
      const r = assessChallenge(c, submissionFor(c.id));
      expect(r.passed, `${c.id}: ${r.needsAttention.map((n) => n.message).join(' | ')}`).toBe(true);
    }
  });

  it('starters fail with explanations of why', () => {
    for (const c of CHALLENGES) {
      const r = assessChallenge(c, { snapshot: c.starter, roleMap: {}, answers: {} });
      expect(r.passed).toBe(false);
      r.needsAttention.forEach((n) => expect(n.why.length).toBeGreaterThan(0));
    }
  });

  it('repair-row rejects the trivial “make everything absorbing” repair', () => {
    const c = CHALLENGES.find((x) => x.id === 'repair-row')!;
    const absorbing = { ...c.starter, P: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], mu0: [1, 0, 0] };
    const r = assessChallenge(c, { snapshot: absorbing, roleMap: {}, answers: {} });
    expect(r.passed).toBe(false);
    expect(r.correct.length).toBe(2);
  });

  it('build-weather accepts any state order and names via role mapping', () => {
    const c = CHALLENGES.find((x) => x.id === 'build-weather')!;
    const swapped: ModelSnapshot = { title: 't', states: [{ id: 's1', label: 'Sunny', x: 0, y: 0 }, { id: 's2', label: 'Rainy', x: 1, y: 0 }], P: [[0.7, 0.3], [0.6, 0.4]], mu0: [1, 0] };
    const roleMap = suggestRoles(c.roles!, swapped);
    expect(roleMap).toEqual({ Sunny: 's1', Rainy: 's2' });
    expect(assessChallenge(c, { snapshot: swapped, roleMap, answers: {} }).passed).toBe(true);
    // Transposed matrix (reading columns as rows) fails with a row-direction explanation.
    const transposed = { ...swapped, P: [[0.7, 0.6], [0.3, 0.4]] };
    const r = assessChallenge(c, { snapshot: transposed, roleMap, answers: {} });
    expect(r.passed).toBe(false);
    expect(r.needsAttention.some((n) => /From/.test(n.why))).toBe(true);
  });

  it('accepts equivalent numeric formats and rejects code', () => {
    expect(parseAnswer('0.18')).toBe(0.18);
    expect(parseAnswer('18%')).toBeCloseTo(0.18, 12);
    expect(parseAnswer('9/50')).toBeCloseTo(0.18, 12);
    expect(parseAnswer('1.8e-1')).toBeCloseTo(0.18, 12);
    expect(parseAnswer('0,18')).toBeCloseTo(0.18, 12);
    expect(parseAnswer('alert(1)')).toBeNull();
    expect(parseAnswer('1/0')).toBeNull();
    const c = CHALLENGES.find((x) => x.id === 'predict-path')!;
    const r = assessChallenge(c, { snapshot: c.starter, roleMap: {}, answers: { conditional: '18%', joint: '0.18' } });
    expect(r.results.map((x) => x.passed)).toEqual([true, false]);
    expect(r.needsAttention[0].why).toMatch(/μ₀/);
  });
});

describe('structural information layer', () => {
  it('reports reducible/absorbing/periodic chains as information, never errors', () => {
    const d = exampleToDocument('gambler');
    const c = compileChain(d);
    if (c.status !== 'ok') throw new Error();
    const s = classifyChain(c.result);
    if (s.status !== 'ok') throw new Error();
    const issues = structuralIssues(d, c.result, s.result);
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(['info.reducible', 'info.multiple-closed', 'info.absorbing']));
    expect(issues.some((i) => i.severity === 'error')).toBe(false);
  });
});
