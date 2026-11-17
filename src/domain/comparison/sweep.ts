// Controlled one-parameter sweeps with row-preserving edits (PLAN.md Phase 5).
// Changing P(from → to) must keep the row a distribution, so the removed/added mass is taken from
// the other entries of the same row by an explicit, recorded rule.

import { rowOf } from '../markov/compile';
import { applyCommand } from '../markov/document';
import { compensatedSum } from '../markov/numeric';
import type { ChainDocumentV1, StateId } from '../markov/types';

export type Rebalance =
  /** Scale every other positive entry of the row by the same factor. */
  | { kind: 'proportional' }
  /** Move the difference into (or out of) one named destination. */
  | { kind: 'compensate'; with: StateId };

export type RowEdit = { ok: true; row: number[] } | { ok: false; reason: string };

/** The full row after setting P(from → to) = value under a rebalancing rule; never silently clips. */
export function rowPreservingEdit(doc: ChainDocumentV1, from: StateId, to: StateId, value: number, rule: Rebalance): RowEdit {
  if (!(value >= 0 && value <= 1)) return { ok: false, reason: 'The value must be between 0 and 1.' };
  const row = rowOf(doc, from);
  const j = doc.stateOrder.indexOf(to);
  if (j < 0 || !doc.stateOrder.includes(from)) return { ok: false, reason: 'Choose states that exist in the model.' };
  const total = compensatedSum(row);
  if (Math.abs(total - 1) > 1e-12) return { ok: false, reason: 'Repair this row first: it does not total 1.' };
  const old = row[j];
  const next = [...row];
  next[j] = value;
  if (rule.kind === 'proportional') {
    const others = 1 - old;
    if (others <= 0) {
      if (value === 1) return { ok: true, row: next };
      return { ok: false, reason: 'No other transitions leave this state, so there is nothing to rescale. Choose a compensating destination instead.' };
    }
    const factor = (1 - value) / others;
    for (let k = 0; k < next.length; k++) if (k !== j) next[k] = row[k] * factor;
  } else {
    const c = doc.stateOrder.indexOf(rule.with);
    if (c < 0) return { ok: false, reason: 'The compensating destination no longer exists.' };
    if (c === j) return { ok: false, reason: 'The compensating destination must differ from the edited one.' };
    const v = row[c] + (old - value);
    if (v < -1e-15 || v > 1 + 1e-15) {
      return { ok: false, reason: `P(→ compensating state) would be ${v.toFixed(4)}, outside 0–1.` };
    }
    // Round away binary noise (1 − 0.8 = 0.19999999999999996) so typed decimals stay readable.
    next[c] = Math.min(1, Math.max(0, Math.round(v * 1e12) / 1e12));
  }
  // Remove rounding drift so the edited row totals exactly 1 within εrow.
  const s = compensatedSum(next);
  return { ok: true, row: next.map((p) => p / s) };
}

export function applyRowEdit(doc: ChainDocumentV1, from: StateId, row: number[]): ChainDocumentV1 {
  return applyCommand(doc, { type: 'setRow', stateId: from, row });
}

/** Evenly spaced grid from min to max inclusive (steps ≥ 2 points), rounded to 1e-10 for clean labels. */
export function sweepGrid(min: number, max: number, points: number): number[] {
  const n = Math.max(2, Math.min(201, Math.floor(points)));
  return Array.from({ length: n }, (_, k) => Math.round((min + ((max - min) * k) / (n - 1)) * 1e10) / 1e10);
}

export interface SweepPoint<T> {
  value: number;
  outcome: { ok: true; doc: ChainDocumentV1; metric: T } | { ok: false; reason: string };
}

/** Evaluate a metric at each grid value; invalid points are reported with a reason, not dropped. */
export function runSweep<T>(doc: ChainDocumentV1, from: StateId, to: StateId, values: number[], rule: Rebalance, metric: (d: ChainDocumentV1) => T): SweepPoint<T>[] {
  return values.map((value) => {
    const e = rowPreservingEdit(doc, from, to, value, rule);
    if (!e.ok) return { value, outcome: e };
    const d = applyRowEdit(doc, from, e.row);
    return { value, outcome: { ok: true, doc: d, metric: metric(d) } };
  });
}
