import { compensatedSum, EPS_ROW, formatSigned, formatTotal } from './numeric';
import type { AnalysisOutcome, ChainDocumentV1, CompiledChain, StateId, ValidationIssue } from './types';

function labelOf(doc: ChainDocumentV1, id: StateId): string {
  return doc.states.find((s) => s.id === id)?.label || id;
}

/** Outgoing probabilities of a state, in canonical order (omitted transitions are exactly 0). */
export function rowOf(doc: ChainDocumentV1, from: StateId): number[] {
  const index = new Map(doc.stateOrder.map((id, i) => [id, i]));
  const row = new Array(doc.stateOrder.length).fill(0);
  for (const t of doc.transitions) {
    if (t.from !== from) continue;
    const j = index.get(t.to);
    if (j !== undefined) row[j] = t.probability;
  }
  return row;
}

export function initialVector(doc: ChainDocumentV1): number[] {
  const byId = new Map(doc.initial.map((e) => [e.stateId, e.probability]));
  return doc.stateOrder.map((id) => byId.get(id) ?? 0);
}

const validProbability = (p: number) => Number.isFinite(p) && p >= 0 && p <= 1;

/** Document/schema and stochastic validity (PLAN.md Module C, layers 1–2, plus recommendations). */
export function validateDocument(doc: ChainDocumentV1): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<StateId>();

  if (doc.stateOrder.length === 0) {
    issues.push({
      code: 'model.empty',
      severity: 'error',
      title: 'The model has no states',
      explanation: 'Create your first state, or open an example to explore a working model.',
      target: { kind: 'document' },
    });
    return issues;
  }

  for (const s of doc.states) {
    if (ids.has(s.id)) {
      issues.push({
        code: 'schema.duplicate-state',
        severity: 'error',
        title: `Duplicate state ID "${s.id}"`,
        explanation: 'Each state needs a unique identifier. Remove or re-create the duplicate state.',
        target: { kind: 'document' },
      });
    }
    ids.add(s.id);
  }
  const orderSet = new Set(doc.stateOrder);
  if (orderSet.size !== doc.stateOrder.length || doc.stateOrder.some((id) => !ids.has(id)) || orderSet.size !== ids.size) {
    issues.push({
      code: 'schema.state-order',
      severity: 'error',
      title: 'State order does not match the state list',
      explanation: 'The file lists states inconsistently. Re-import a corrected file.',
      target: { kind: 'document' },
    });
  }

  const pairs = new Set<string>();
  for (const t of doc.transitions) {
    if (!ids.has(t.from) || !ids.has(t.to)) {
      issues.push({
        code: 'schema.missing-endpoint',
        severity: 'error',
        title: 'Transition refers to a missing state',
        explanation: `A transition from "${t.from}" to "${t.to}" points at a state that does not exist.`,
        target: { kind: 'document' },
      });
      continue;
    }
    const key = `${t.from}\u0000${t.to}`;
    if (pairs.has(key)) {
      issues.push({
        code: 'schema.duplicate-transition',
        severity: 'error',
        title: `Duplicate transition ${labelOf(doc, t.from)} → ${labelOf(doc, t.to)}`,
        explanation: 'Each ordered pair of states has exactly one probability.',
        target: { kind: 'cell', from: t.from, to: t.to },
      });
    }
    pairs.add(key);
    if (!validProbability(t.probability)) {
      issues.push({
        code: 'cell.out-of-range',
        severity: 'error',
        title: `${labelOf(doc, t.from)} → ${labelOf(doc, t.to)} is not a probability`,
        explanation: 'Enter a probability from 0 to 1. Normalization cannot repair out-of-range values.',
        target: { kind: 'cell', from: t.from, to: t.to },
      });
    }
  }
  if (issues.some((i) => i.severity === 'error')) return issues;

  for (const id of doc.stateOrder) {
    const row = rowOf(doc, id);
    const sum = compensatedSum(row);
    if (Math.abs(sum - 1) > EPS_ROW) {
      const name = labelOf(doc, id);
      const diff = sum - 1;
      issues.push({
        code: sum === 0 ? 'row.zero' : 'row.sum',
        severity: 'error',
        title:
          sum === 0
            ? `${name} has no outgoing probability`
            : `Transitions from ${name} total ${formatTotal(sum)}`,
        explanation:
          sum === 0
            ? `Every state must go somewhere at each step. Make ${name} absorbing (stay with probability 1) or add outgoing transitions.`
            : `${diff > 0 ? 'Reduce' : 'Increase'} this row by ${formatSigned(diff).slice(1)} before running. Rows must total exactly 1 because the chain always moves somewhere.`,
        target: { kind: 'row', stateId: id },
        repairs: sum === 0 ? ['make-absorbing', 'distribute-equally'] : ['normalize-row'],
      });
    }
  }

  const initialIds = new Set<StateId>();
  let initialBad = false;
  for (const e of doc.initial) {
    if (!ids.has(e.stateId) || initialIds.has(e.stateId) || !validProbability(e.probability)) initialBad = true;
    initialIds.add(e.stateId);
  }
  if (initialBad) {
    issues.push({
      code: 'initial.invalid-entry',
      severity: 'error',
      title: 'Starting distribution has an invalid entry',
      explanation: 'Each starting probability must be from 0 to 1 and refer to an existing state.',
      target: { kind: 'initial' },
    });
  } else {
    const sum = compensatedSum(initialVector(doc));
    if (Math.abs(sum - 1) > EPS_ROW) {
      issues.push({
        code: 'initial.sum',
        severity: 'error',
        title: sum === 0 ? 'No starting distribution' : `Starting distribution totals ${formatTotal(sum)}`,
        explanation: 'Choose a starting state or enter a distribution that totals 1.',
        target: { kind: 'initial' },
        repairs: sum > 0 ? ['normalize-initial'] : undefined,
      });
    }
  }

  const seen = new Map<string, number>();
  for (const s of doc.states) {
    const key = s.label.trim().toLowerCase();
    if (!key) {
      issues.push({
        code: 'rec.unnamed-state',
        severity: 'recommendation',
        title: 'A state has no name',
        explanation: 'Name every state so the matrix, charts, and paths stay readable.',
        target: { kind: 'row', stateId: s.id },
      });
    }
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [key, n] of seen) {
    if (key && n > 1) {
      issues.push({
        code: 'rec.duplicate-label',
        severity: 'recommendation',
        title: `${n} states share the name "${key}"`,
        explanation: 'Identical names make results hard to read. The model still works because states have separate IDs.',
        target: { kind: 'document' },
      });
    }
  }
  return issues;
}

function hashString(text: string): string {
  // FNV-1a 32-bit, twice with different offsets for a 64-bit-ish fingerprint.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/** Compile a validated document into an immutable numeric snapshot. */
export function compileChain(doc: ChainDocumentV1): AnalysisOutcome<CompiledChain> {
  const errors = validateDocument(doc).filter((i) => i.severity === 'error');
  if (errors.length) return { status: 'invalid', issues: errors.map((e) => e.title) };

  const adjustments: { location: string; beforeSum: number }[] = [];
  const P = doc.stateOrder.map((id) => {
    const row = rowOf(doc, id);
    const sum = compensatedSum(row);
    if (sum !== 1) {
      adjustments.push({ location: `row:${id}`, beforeSum: sum });
      return Object.freeze(row.map((v) => v / sum));
    }
    return Object.freeze(row);
  });
  let initial = initialVector(doc);
  const initSum = compensatedSum(initial);
  if (initSum !== 1) {
    adjustments.push({ location: 'initial', beforeSum: initSum });
    initial = initial.map((v) => v / initSum);
  }
  const stateIds = Object.freeze([...doc.stateOrder]);
  const modelHash = hashString(JSON.stringify([stateIds, P, initial]));
  const chain: CompiledChain = Object.freeze({
    modelHash,
    stateIds,
    P: Object.freeze(P),
    initial: Object.freeze(initial),
    adjustments: Object.freeze(adjustments),
  });
  return {
    status: 'ok',
    result: chain,
    method: 'compile',
    warnings: adjustments.length ? [`${adjustments.length} vector(s) rescaled within floating-point tolerance.`] : [],
    modelHash,
  };
}
