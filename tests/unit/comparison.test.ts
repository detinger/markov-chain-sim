import { describe, expect, it } from 'vitest';
import { exampleToDocument } from '../../src/lib/examples';
import {
  alignByStableId, alignExplicit, applyRowEdit, compareScalars, compareScenarios, judge, modelChanges, rowPreservingEdit, runSweep, sweepGrid,
} from '../../src/domain/comparison';
import { applyCommand, rowOf, compensatedSum } from '../../src/domain/markov';
import { newcombeDifference, welchDifference, meanInterval } from '../../src/domain/statistics/intervals';
import { assessChallenge, documentToSnapshot } from '../../src/domain/assessment';
import { CHALLENGE_BY_ID } from '../../src/data/challenges';

const fin = (value: number) => ({ kind: 'finite' as const, value });

describe('change semantics', () => {
  it('signed difference and relative change for a finite nonzero baseline', () => {
    const c = compareScalars(fin(0.2), fin(0.25));
    expect(c.difference).toEqual({ kind: 'finite', value: expect.closeTo(0.05, 12) });
    expect(c.relative.kind === 'finite' && c.relative.value).toBeCloseTo(25, 10);
    expect(c.direction).toBe('up');
  });
  it('relative change is not defined for a zero baseline', () => {
    const c = compareScalars(fin(0), fin(0.1));
    expect(c.difference.kind).toBe('finite');
    expect(c.relative.kind).toBe('undefined');
  });
  it('infinite and undefined values never produce NaN', () => {
    expect(compareScalars({ kind: 'infinite' }, fin(3)).difference.kind).toBe('undefined');
    expect(compareScalars(fin(3), { kind: 'infinite' }).difference.kind).toBe('infinite');
    const both = compareScalars({ kind: 'infinite' }, { kind: 'infinite' });
    expect(both.difference.kind).toBe('undefined');
    expect(both.direction).toBe('same');
    const u = compareScalars({ kind: 'undefined', reason: 'x' }, fin(1));
    expect(u.direction).toBeNull();
  });
  it('no verdict without an objective; objective decides direction', () => {
    const c = compareScalars(fin(1), fin(2));
    expect(judge(c, null)).toBeNull();
    expect(judge(c, 'increase')).toBe('improves');
    expect(judge(c, 'decrease')).toBe('worsens');
  });
});

describe('alignment and changes', () => {
  const base = exampleToDocument('weather');
  it('duplicated projects align by stable ID; added states are reported', () => {
    const alt = applyCommand(base, { type: 'addState', id: 'fog', label: 'Fog', x: 0, y: 0 });
    const al = alignByStableId(base, alt);
    expect(al.source).toBe('stable-id');
    expect(al.pairs).toHaveLength(base.stateOrder.length);
    expect(al.altOnly).toEqual(['fog']);
    expect(modelChanges(base, alt, al).some((c) => c.kind === 'state-added')).toBe(true);
  });
  it('equal labels are not identity: unrelated models need an explicit mapping', () => {
    const other = { ...base, stateOrder: base.stateOrder.map((id) => `x${id}`), states: base.states.map((s) => ({ ...s, id: `x${s.id}` })) };
    expect(alignByStableId(base, other).source).toBe('none');
    const dup = alignExplicit(base, other, { [base.stateOrder[0]]: other.stateOrder[0], [base.stateOrder[1]]: other.stateOrder[0] });
    expect('error' in dup).toBe(true);
  });
  it('lists every changed probability and initial mass exactly', () => {
    const [a, b] = base.stateOrder;
    const row = rowOf(base, a);
    const alt = applyCommand(applyCommand(base, { type: 'setRow', stateId: a, row: row.map((_, j) => (j === 0 ? 0.5 : j === 1 ? 0.5 : 0)) }), { type: 'setSingleStart', stateId: b });
    const ch = modelChanges(base, alt, alignByStableId(base, alt));
    expect(ch.filter((c) => c.kind === 'transition').length).toBeGreaterThan(0);
    expect(ch.filter((c) => c.kind === 'initial').length).toBe(2);
  });
});

describe('exact scenario comparison', () => {
  const casino = exampleToDocument('gambler');
  it('identical scenarios differ by exactly zero', () => {
    const r = compareScenarios(casino, casino, alignByStableId(casino, casino), { horizon: 20, targetIds: ['6'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const m of r.result.metrics) expect(['same', null]).toContain(m.change.direction);
    expect(r.result.changes).toEqual([]);
  });
  it('Casino strategy change matches the hand calculation', () => {
    // Baseline from Playing Safe: r5 = 10/13, r4 = 5/13, r3 = (2/13)/0.85, r2 = r3/2 = 1/11.05.
    const alt = applyRowEdit(casino, '3', [0.3, 0, 0, 0.7, 0, 0]);
    const r = compareScenarios(casino, alt, alignByStableId(casino, alt), { horizon: 50, targetIds: ['6'] });
    if (!r.ok) throw new Error('compare failed');
    const rich = r.result.metrics.find((m) => m.id === 'absorb:6')!;
    expect(rich.base.kind === 'finite' && rich.base.value).toBeCloseTo(1 / 11.05, 10);
    expect(rich.alt.kind === 'finite' && rich.alt.value).toBeCloseTo(0.7 * (5 / 13) / 2, 10);
    // Ruin is possible, so the unconditional expected time to reach Rich is infinite in both.
    const mean = r.result.metrics.find((m) => m.id === 'mean-hit')!;
    expect(mean.base.kind).toBe('infinite');
    expect(mean.change.difference.kind).toBe('undefined');
    expect(r.result.changes.filter((c) => c.kind === 'transition')).toHaveLength(2);
  });
  it('a target missing from the alternative is disclosed, not compared', () => {
    const alt = applyCommand(casino, { type: 'deleteState', id: '6' });
    const r = compareScenarios(casino, applyCommand(alt, { type: 'normalizeRow', stateId: '5' }), alignByStableId(casino, alt), { horizon: 10, targetIds: ['6'] });
    if (!r.ok) throw new Error('compare failed');
    const m = r.result.metrics.find((x) => x.id === 'hit-by-h')!;
    expect(m.alt.kind).toBe('undefined');
    expect(m.note).toMatch(/no counterpart/);
  });
  it('finite-horizon reward = Σₜ μₜ·r with the stated semantics', () => {
    const w = exampleToDocument('weather');
    const rewards = Object.fromEntries(w.stateOrder.map((id, i) => [id, i === 0 ? 1 : 0]));
    const r = compareScenarios(w, w, alignByStableId(w, w), { horizon: 5, targetIds: [], rewards });
    if (!r.ok) throw new Error('compare failed');
    const reward = r.result.metrics.find((m) => m.id === 'reward')!;
    const occ = r.result.perState[0].occupancy.base * 6;
    expect(reward.base.kind === 'finite' && reward.base.value).toBeCloseTo(occ, 12);
  });
  it('an invalid scenario is reported by side', () => {
    const bad = applyCommand(casino, { type: 'setProbability', from: '2', to: '2', probability: 0.9 });
    const r = compareScenarios(casino, bad, alignByStableId(casino, bad), { horizon: 5, targetIds: [] });
    expect(r.ok === false && r.side).toBe('alternative');
  });
});

describe('row-preserving sweeps', () => {
  const casino = exampleToDocument('gambler');
  it('proportional rebalancing keeps the row a distribution and ratios fixed', () => {
    const e = rowPreservingEdit(casino, '3', '4', 0.6, { kind: 'proportional' });
    if (!e.ok) throw new Error(e.reason);
    expect(compensatedSum(e.row)).toBeCloseTo(1, 14);
    expect(e.row[0] / e.row[1]).toBeCloseTo(1, 12);
    expect(e.row[3]).toBe(0.6);
  });
  it('compensation outside 0–1 is refused with a reason', () => {
    const e = rowPreservingEdit(casino, '3', '4', 0.9, { kind: 'compensate', with: '2' });
    expect(e.ok).toBe(false);
  });
  it('lowering an absorbing self-loop has nothing to rescale proportionally', () => {
    expect(rowPreservingEdit(casino, '1', '1', 0.8, { kind: 'proportional' }).ok).toBe(false);
    const e = rowPreservingEdit(casino, '1', '1', 0.8, { kind: 'compensate', with: '2' });
    expect(e.ok && e.row.slice(0, 2)).toEqual([0.8, 0.2]);
  });
  it('sweep evaluates each grid point and keeps invalid points with reasons', () => {
    const pts = runSweep(casino, '3', '4', sweepGrid(0, 1, 11), { kind: 'compensate', with: '2' }, (d) => d.modelRevision);
    expect(pts).toHaveLength(11);
    expect(pts.filter((p) => !p.outcome.ok).length).toBe(3); // 0.8, 0.9, 1.0 need more than the 0.3 available
  });
});

describe('difference intervals', () => {
  it('Newcombe hybrid score matches the published example (56/70 vs 48/80)', () => {
    const d = newcombeDifference(48, 80, 56, 70)!;
    expect(d.estimate).toBeCloseTo(0.2, 12);
    expect(d.lower).toBeCloseTo(0.0524, 4);
    expect(d.upper).toBeCloseTo(0.3339, 4);
  });
  it('Welch interval is centered on the difference and needs n ≥ 2', () => {
    const a = meanInterval(10, 30, 5);
    const b = meanInterval(20, 100, 5);
    const w = welchDifference(a, b)!;
    expect(w.estimate).toBeCloseTo(b.mean - a.mean, 12);
    expect(w.lower).toBeLessThan(w.estimate);
    expect(welchDifference(meanInterval(1, 1, 1), b)).toBeNull();
  });
});

describe('comparison challenges', () => {
  it('Doomscroll: moving reels mass into another loop fails with a metric explanation', () => {
    const def = CHALLENGE_BY_ID['escape-trap'];
    const P = def.starter.P.map((r, i) => (i === 2 ? [0, 0.5, 0.5, 0, 0, 0, 0] : r));
    const r = assessChallenge(def, { snapshot: { ...def.starter, P }, roleMap: {}, answers: {} });
    expect(r.passed).toBe(false);
    expect(r.needsAttention.map((n) => n.message).join(' ')).toMatch(/Expected steps.*17\.000 steps/);
  });
  it('Casino: editing a fixed row is caught even if the goal is met', () => {
    const def = CHALLENGE_BY_ID['compare-strategies'];
    const P = def.reference.snapshot!.P.map((r, i) => (i === 1 ? [0.1, 0.6, 0.3, 0, 0, 0] : r));
    const r = assessChallenge(def, { snapshot: { ...def.starter, P }, roleMap: {}, answers: {} });
    expect(r.passed).toBe(false);
    expect(r.needsAttention[0].message).toMatch(/must stay as given/);
  });
  it('starters are the unmodified examples', () => {
    expect(CHALLENGE_BY_ID['escape-trap'].starter.P).toEqual(documentToSnapshot(exampleToDocument('socialMedia')).P);
  });
});
