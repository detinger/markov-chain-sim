import { describe, expect, it } from 'vitest';
import { CHALLENGES, CHALLENGE_BY_ID } from '../../src/data/challenges';
import { LESSONS, LESSON_BY_ID } from '../../src/data/lessons';
import {
  assessChallenge, diagnoseNumeric, documentToSnapshot, evaluateStateSet, evaluateTarget, snapshotToDocument, type ModelSnapshot,
} from '../../src/domain/assessment';
import {
  absorptionAnalysis, classifyChain, compileChain, hittingAnalysis, stationaryDistributions, type ChainDocumentV1,
} from '../../src/domain/markov';
import { ALL_EXAMPLES, EXAMPLES, EXAMPLE_META, TEACHING_EXAMPLES, exampleToDocument } from '../../src/lib/examples';
import { migrateProgress, type ContentVersion } from '../../src/features/learning/migrateProgress';
import { runSmallExperiment } from '../../src/features/learning/ExperimentRuns';

const chainOf = (s: ModelSnapshot | ChainDocumentV1) => {
  const c = compileChain('P' in s ? snapshotToDocument(s) : s);
  if (c.status !== 'ok') throw new Error('invalid fixture');
  return c.result;
};
const ok = <T,>(o: { status: string; result?: T }) => { if (o.status !== 'ok') throw new Error(o.status); return o.result as T; };

describe('all twelve challenge types (PLAN.md §5 Module G)', () => {
  it('has one instance of each', () => {
    expect(new Set(CHALLENGES.map((c) => c.id))).toEqual(new Set([
      'repair-row', 'build-weather', 'predict-path', 'predict-two-steps', 'stationary-not-convergence', 'find-closed-classes',
      'casino-outcomes', 'escape-trap', 'first-hit-vs-occupancy', 'compare-strategies', 'diagnose-sir', 'interpret-uncertainty',
    ]));
  });
  it('every prerequisite and lesson link resolves; every rubric criterion is unique within a challenge', () => {
    for (const c of CHALLENGES) {
      c.prerequisites.forEach((p) => expect(LESSON_BY_ID[p], `${c.id} → ${p}`).toBeDefined());
      const r = assessChallenge(c, { snapshot: c.starter, roleMap: {}, answers: {} });
      const crit = r.results.map((x) => x.criterion);
      expect(new Set(crit).size, c.id).toBe(crit.length);
      crit.forEach((x) => expect(x.length).toBeGreaterThan(0));
    }
    for (const l of LESSONS) for (const s of l.sections) if (s.kind === 'try') expect(CHALLENGE_BY_ID[s.challengeId], s.challengeId).toBeDefined();
  });
});

describe('multiple-choice keys and stated facts are checked against exact analysis', () => {
  it('stationary is not convergence: π = [0.5, 0.5], period 2, μ₁₀₁(A) = 0', () => {
    const c = CHALLENGE_BY_ID['stationary-not-convergence'];
    expect(evaluateTarget(c.starter, { type: 'stationary', state: 'a' })).toBeCloseTo(0.5, 12);
    expect(evaluateTarget(c.starter, { type: 'distribution', t: 101, state: 'a' })).toBe(0);
    expect(ok(classifyChain(chainOf(c.starter))).classes[0].period).toBe(2);
    expect(evaluateTarget({ ...c.starter, mu0: [0.5, 0.5] }, { type: 'distribution', t: 7, state: 'a' })).toBeCloseTo(0.5, 12);
  });
  it('find closed classes: sets, and the fate from A is {D, E} with probability 1', () => {
    const c = CHALLENGE_BY_ID['find-closed-classes'];
    expect(evaluateStateSet(c.starter, 'closed')!.sort()).toEqual(['d', 'e', 'f', 'g']);
    expect(evaluateStateSet(c.starter, 'transient')!.sort()).toEqual(['a', 'b', 'c', 'h']);
    const chain = chainOf(c.starter);
    expect(ok(hittingAnalysis(chain, ['d', 'e'])).probability[0]).toBe(1);
    expect(ok(hittingAnalysis(chain, ['f', 'g'])).probability[0]).toBe(0);
    expect(ok(classifyChain(chain)).reachableFromInitial[chain.stateIds.indexOf('f')]).toBe(false);
  });
  it('casino outcomes match the hand solution 3/7, 4/7, 16/7', () => {
    const c = CHALLENGE_BY_ID['casino-outcomes'];
    expect(evaluateTarget(c.starter, { type: 'absorb', from: 'low', into: 'rich' })).toBeCloseTo(3 / 7, 12);
    expect(evaluateTarget(c.starter, { type: 'absorb', from: 'low', into: 'ruin' })).toBeCloseTo(4 / 7, 12);
    expect(evaluateTarget(c.starter, { type: 'expected-steps', from: 'low' })).toBeCloseTo(16 / 7, 12);
    // Fractions are accepted as answers.
    expect(assessChallenge(c, { snapshot: c.starter, roleMap: {}, answers: { rich: '3/7', ruin: '4/7', steps: '16/7' } }).passed).toBe(true);
  });
  it('first hit (0.75) exceeds occupancy (0.35) because paths leave the Shop', () => {
    const c = CHALLENGE_BY_ID['first-hit-vs-occupancy'];
    expect(evaluateTarget(c.starter, { type: 'hit-by', targets: ['shop'], t: 2 })).toBeCloseTo(0.75, 12);
    expect(evaluateTarget(c.starter, { type: 'distribution', t: 2, state: 'shop' })).toBeCloseTo(0.35, 12);
  });
  it('SIR: 5 expected infected days; infection probability is a constant row entry', () => {
    const c = CHALLENGE_BY_ID['diagnose-sir'];
    expect(evaluateTarget(c.starter, { type: 'expected-steps', from: '2' })).toBeCloseTo(5, 12);
    expect(c.starter.P[0][1]).toBe(0.05);
  });
  it('uncertainty: the large run is about 10× narrower; the ±10–13 pp claim holds for M = 50', () => {
    const c = CHALLENGE_BY_ID['interpret-uncertainty'];
    const chain = chainOf(c.starter);
    const i = chain.stateIds.indexOf('rain');
    const [small, large] = c.experiment!.runs.map((r) => runSmallExperiment(chain, 10, r.replications, r.seed).endpoint[10][i]!);
    const ratio = (small.upper - small.lower) / (large.upper - large.lower);
    expect(ratio).toBeGreaterThan(7);
    expect(ratio).toBeLessThan(14);
    const half = (small.upper - small.lower) / 2;
    expect(half).toBeGreaterThan(0.09);
    expect(half).toBeLessThan(0.14);
  });
});

describe('explainable feedback for common wrong answers', () => {
  const why = (id: string, answers: Record<string, string>) => assessChallenge(CHALLENGE_BY_ID[id], { snapshot: CHALLENGE_BY_ID[id].starter, roleMap: {}, answers }).needsAttention.map((n) => n.why).join(' ');
  it('occupancy given for a first-hit question', () => {
    expect(why('first-hit-vs-occupancy', { hit: '0.35' })).toMatch(/being there/);
  });
  it('joint probability given for a conditional question', () => {
    expect(why('predict-path', { conditional: '0.09' })).toMatch(/μ₀/);
  });
  it('matrix read by columns', () => {
    const c = CHALLENGE_BY_ID['predict-two-steps'];
    const wrong = diagnoseNumeric(c.starter, { type: 'distribution', t: 2, state: 'car' }).find((d) => /columns/.test(d.why))!;
    expect(why('predict-two-steps', { mu2car: String(wrong.value) })).toMatch(/columns/);
  });
  it('one-step probability given for an absorption probability', () => {
    expect(why('casino-outcomes', { rich: '0' })).toMatch(/one-step/);
  });
  it('a misconception value equal to the right answer is never flagged', () => {
    for (const c of CHALLENGES) for (const a of c.assertions) {
      if (a.kind !== 'numeric-answer') continue;
      const exact = evaluateTarget(c.starter, a.target)!;
      const r = assessChallenge(c, { snapshot: c.starter, roleMap: {}, answers: { [a.key]: String(exact) } });
      expect(r.results.find((x) => x.criterion === a.label)!.passed, `${c.id}/${a.key}`).toBe(true);
    }
  });
});

describe('model-permutation tolerance', () => {
  /** Reverse state order and rename every ID; returns the permuted snapshot and the ID map. */
  function permute(s: ModelSnapshot): { snap: ModelSnapshot; map: Record<string, string> } {
    const order = s.states.map((_, i) => s.states.length - 1 - i);
    const map = Object.fromEntries(s.states.map((st) => [st.id, `p-${st.id}`]));
    return {
      map,
      snap: {
        ...s,
        states: order.map((i) => ({ ...s.states[i], id: map[s.states[i].id] })),
        P: order.map((i) => order.map((j) => s.P[i][j])),
        mu0: order.map((i) => s.mu0[i]),
      },
    };
  }

  it('analysis results are invariant under reordering and renaming states, for every example', () => {
    for (const key of Object.keys(ALL_EXAMPLES)) {
      const s = documentToSnapshot(exampleToDocument(key));
      const { snap, map } = permute(s);
      const a = chainOf(s); const b = chainOf(snap);
      const ia = (id: string) => a.stateIds.indexOf(id);
      const ib = (id: string) => b.stateIds.indexOf(map[id]);
      const sa = ok(stationaryDistributions(a)); const sb = ok(stationaryDistributions(b));
      for (const st of s.states) expect(sb.mixture[ib(st.id)], `${key} π`).toBeCloseTo(sa.mixture[ia(st.id)], 10);
      const target = s.states[s.states.length - 1].id;
      const ha = ok(hittingAnalysis(a, [target])); const hb = ok(hittingAnalysis(b, [map[target]]));
      for (const st of s.states) {
        expect(hb.probability[ib(st.id)], `${key} h`).toBeCloseTo(ha.probability[ia(st.id)], 10);
        expect(hb.meanTime[ib(st.id)].kind).toBe(ha.meanTime[ia(st.id)].kind);
      }
      const aa = absorptionAnalysis(a); const ab = absorptionAnalysis(b);
      expect(ab.status).toBe(aa.status);
    }
  });

  it('build-weather accepts any state order, IDs, and names through the role mapping', () => {
    const c = CHALLENGE_BY_ID['build-weather'];
    const snap: ModelSnapshot = {
      title: 'Mine', states: [{ id: 'x1', label: 'Wet', x: 0, y: 0 }, { id: 'x2', label: 'Clear', x: 9, y: 9 }],
      P: [[0.4, 0.6], [0.3, 0.7]], mu0: [0, 1],
    };
    expect(assessChallenge(c, { snapshot: snap, roleMap: { Sunny: 'x2', Rainy: 'x1' }, answers: {} }).passed).toBe(true);
    // The same model with the roles swapped is wrong, and the feedback explains row direction.
    const r = assessChallenge(c, { snapshot: snap, roleMap: { Sunny: 'x1', Rainy: 'x2' }, answers: {} });
    expect(r.passed).toBe(false);
    expect(r.needsAttention[0].why).toMatch(/row/);
  });

  it('comparison challenges grade by state identity, not row order', () => {
    for (const id of ['compare-strategies', 'escape-trap']) {
      const c = CHALLENGE_BY_ID[id];
      const ref = c.reference.snapshot!;
      const order = ref.states.map((_, i) => ref.states.length - 1 - i);
      const reordered: ModelSnapshot = { ...ref, states: order.map((i) => ref.states[i]), P: order.map((i) => order.map((j) => ref.P[i][j])), mu0: order.map((i) => ref.mu0[i]) };
      expect(assessChallenge(c, { snapshot: reordered, roleMap: {}, answers: {} }).passed, id).toBe(true);
    }
  });
});

describe('progress migration', () => {
  const lessons: Record<string, ContentVersion> = {
    a: { title: 'A', version: 2, progressCompatibleFrom: 1, checkIds: ['q1'] },
    b: { title: 'B', version: 3 },
  };
  const challenges: Record<string, ContentVersion> = { c: { title: 'C', version: 1 } };

  it('keeps compatible progress, upgrades its version, and drops removed questions', () => {
    const r = migrateProgress({ schemaVersion: 1, lessons: { a: { version: 1, completedAt: '2026-01-01T00:00:00Z', checks: { q1: { correct: true, attempts: 2 }, gone: { correct: true, attempts: 1 } } } }, challenges: {} }, lessons, challenges);
    expect(r.status).toBe('ok');
    expect(r.progress.lessons.a).toEqual({ version: 2, completedAt: '2026-01-01T00:00:00Z', checks: { q1: { correct: true, attempts: 2 } } });
    expect(r.progress.resetNotes).toBeUndefined();
  });
  it('resets incompatible progress with an explanation; drops deleted content silently', () => {
    const r = migrateProgress({ schemaVersion: 1, lessons: { b: { version: 1, checks: {} }, zombie: { version: 1, checks: {} } }, challenges: { c: { version: 1, attempts: 3, hintsUsed: 1, passedAt: 'x' } } }, lessons, challenges);
    expect(r.progress.lessons).toEqual({});
    expect(r.progress.resetNotes).toEqual(['Lesson “B” was updated; its progress was reset.']);
    expect(r.progress.challenges.c).toEqual({ version: 1, attempts: 3, hintsUsed: 1 }); // invalid date dropped
  });
  it('sanitizes malformed values and flags unreadable or foreign data for backup', () => {
    const r = migrateProgress({ schemaVersion: 1, lessons: { a: { version: 2, checks: { q1: { correct: 'yes', attempts: -4 } } } }, challenges: [] }, lessons, challenges);
    expect(r.progress.lessons.a.checks.q1).toEqual({ correct: false, attempts: 0 });
    expect(migrateProgress({ schemaVersion: 7 }, lessons, challenges).status).toBe('unreadable');
    expect(migrateProgress('<invalid JSON>', lessons, challenges).status).toBe('unreadable');
    expect(migrateProgress(null, lessons, challenges)).toEqual({ status: 'ok', progress: { schemaVersion: 1, lessons: {}, challenges: {} } });
  });
  it('real lessons that only gained links keep version-1 progress', () => {
    const bumped = LESSONS.filter((l) => l.version > 1);
    expect(bumped.length).toBeGreaterThan(0);
    for (const l of bumped) expect(l.progressCompatibleFrom).toBe(1);
  });
});

describe('example library (PLAN.md §6)', () => {
  it('original example data is unchanged and listed first; every example is a valid chain with metadata', () => {
    expect(Object.keys(ALL_EXAMPLES).slice(0, Object.keys(EXAMPLES).length)).toEqual(Object.keys(EXAMPLES));
    expect(Object.keys(EXAMPLES)).toEqual(['weather', 'stockMarket', 'pagerank', 'epidemic', 'gambler', 'socialMedia']);
    for (const key of Object.keys(ALL_EXAMPLES)) {
      expect(compileChain(exampleToDocument(key)).status, key).toBe('ok');
      expect(EXAMPLE_META[key]?.assumptions.length, key).toBeGreaterThan(0);
      if (EXAMPLE_META[key].lesson) expect(LESSON_BY_ID[EXAMPLE_META[key].lesson!]).toBeDefined();
    }
    for (const key of Object.keys(TEACHING_EXAMPLES)) expect(EXAMPLE_META[key].group).toBe('teaching');
  });
  it('SIR is labeled as an individual-status model and states its fixed-rate limit', () => {
    expect(EXAMPLE_META.epidemic.subtitle).toBe('Simplified individual-status Markov model');
    expect(EXAMPLE_META.epidemic.assumptions.join(' ')).toMatch(/currently infected/);
  });
  it('teaching examples satisfy their stated analytic properties', () => {
    const c = (k: string) => chainOf(exampleToDocument(k));
    const alt = ok(stationaryDistributions(c('alternator')));
    expect(alt.extremal[0].period).toBe(2);
    expect(alt.extremal[0].pi[0]).toBeCloseTo(0.5, 12);

    const two = ok(absorptionAnalysis(c('twoOutcomes')));
    expect(two.B[0][two.absorbing.indexOf(1)]).toBeCloseTo(0.6, 12);
    expect(two.t[0]).toBeCloseTo(2, 12);

    const red = ok(classifyChain(c('reducible')));
    expect(red.classes).toHaveLength(3);
    expect(red.reachableFromInitial[3]).toBe(false);

    const sticky = ok(hittingAnalysis(c('stickyRare'), ['free']));
    expect(sticky.meanTime[0]).toEqual({ kind: 'finite', value: expect.closeTo(100, 8) });

    const unreach = ok(hittingAnalysis(c('unreachableTarget'), ['island']));
    expect(unreach.probability[0]).toBe(0);
    expect(unreach.meanTime[0].kind).toBe('infinite');

    expect(ok(stationaryDistributions(c('oneState'))).mixture).toEqual([1]);
  });
});
