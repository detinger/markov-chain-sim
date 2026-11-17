import { rowOf } from './compile';
import { compensatedSum } from './numeric';
import type { ChainDocumentV1, StateId } from './types';

export function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `${prefix}-${rand}`;
}

export function createEmptyDocument(title = 'Untitled model'): ChainDocumentV1 {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: newId('proj'),
    title,
    modelRevision: 0,
    layoutRevision: 0,
    stateOrder: [],
    states: [],
    transitions: [],
    initial: [],
    layout: { positions: {} },
    metadata: { createdAt: now, updatedAt: now },
  };
}

/** Atomic, undoable model edits (PLAN.md §7.5). Selection/hover/UI state is never a command. */
export type Command =
  | { type: 'addState'; id: StateId; label: string; x: number; y: number }
  | { type: 'renameState'; id: StateId; label: string }
  | { type: 'moveState'; id: StateId; x: number; y: number }
  | { type: 'deleteState'; id: StateId }
  | { type: 'setProbability'; from: StateId; to: StateId; probability: number }
  | { type: 'setInitial'; stateId: StateId; probability: number }
  | { type: 'setSingleStart'; stateId: StateId }
  | { type: 'normalizeRow'; stateId: StateId }
  /** Replace a whole row at once (row-preserving parameter edits; one undo step). */
  | { type: 'setRow'; stateId: StateId; row: number[] }
  | { type: 'makeAbsorbing'; stateId: StateId }
  | { type: 'distributeEqually'; stateId: StateId }
  | { type: 'normalizeInitial' }
  | { type: 'setTitle'; title: string }
  | { type: 'setStepLabel'; stepLabel: string };

const LAYOUT_ONLY = new Set<Command['type']>(['moveState', 'renameState', 'setTitle', 'setStepLabel']);

function replaceRow(doc: ChainDocumentV1, from: StateId, row: number[]): ChainDocumentV1['transitions'] {
  const others = doc.transitions.filter((t) => t.from !== from);
  const mine = row.flatMap((p, j) => (p > 0 ? [{ from, to: doc.stateOrder[j], probability: p }] : []));
  return [...others, ...mine];
}

export function applyCommand(doc: ChainDocumentV1, cmd: Command): ChainDocumentV1 {
  let next: ChainDocumentV1 = doc;
  switch (cmd.type) {
    case 'addState': {
      const first = doc.stateOrder.length === 0;
      next = {
        ...doc,
        stateOrder: [...doc.stateOrder, cmd.id],
        states: [...doc.states, { id: cmd.id, label: cmd.label }],
        // A new state stays put with probability 1 so existing rows remain valid.
        transitions: [...doc.transitions, { from: cmd.id, to: cmd.id, probability: 1 }],
        initial: [...doc.initial, { stateId: cmd.id, probability: first ? 1 : 0 }],
        layout: { ...doc.layout, positions: { ...doc.layout.positions, [cmd.id]: { x: cmd.x, y: cmd.y } } },
      };
      break;
    }
    case 'renameState':
      next = { ...doc, states: doc.states.map((s) => (s.id === cmd.id ? { ...s, label: cmd.label } : s)) };
      break;
    case 'moveState':
      next = { ...doc, layout: { ...doc.layout, positions: { ...doc.layout.positions, [cmd.id]: { x: cmd.x, y: cmd.y } } } };
      break;
    case 'deleteState': {
      const positions = { ...doc.layout.positions };
      delete positions[cmd.id];
      next = {
        ...doc,
        stateOrder: doc.stateOrder.filter((id) => id !== cmd.id),
        states: doc.states.filter((s) => s.id !== cmd.id),
        transitions: doc.transitions.filter((t) => t.from !== cmd.id && t.to !== cmd.id),
        initial: doc.initial.filter((e) => e.stateId !== cmd.id),
        layout: { ...doc.layout, positions },
      };
      break;
    }
    case 'setProbability': {
      const rest = doc.transitions.filter((t) => !(t.from === cmd.from && t.to === cmd.to));
      // Zero means "no mathematical edge"; the matrix cell still shows 0.
      next = { ...doc, transitions: cmd.probability === 0 ? rest : [...rest, { from: cmd.from, to: cmd.to, probability: cmd.probability }] };
      break;
    }
    case 'setInitial':
      next = { ...doc, initial: doc.initial.map((e) => (e.stateId === cmd.stateId ? { ...e, probability: cmd.probability } : e)) };
      break;
    case 'setSingleStart':
      next = { ...doc, initial: doc.stateOrder.map((id) => ({ stateId: id, probability: id === cmd.stateId ? 1 : 0 })) };
      break;
    case 'normalizeRow': {
      const row = rowOf(doc, cmd.stateId);
      const sum = compensatedSum(row);
      if (!(sum > 0) || row.some((p) => !(p >= 0 && Number.isFinite(p)))) return doc;
      next = { ...doc, transitions: replaceRow(doc, cmd.stateId, row.map((p) => p / sum)) };
      break;
    }
    case 'setRow':
      if (cmd.row.length !== doc.stateOrder.length || cmd.row.some((p) => !(p >= 0 && p <= 1))) return doc;
      next = { ...doc, transitions: replaceRow(doc, cmd.stateId, cmd.row) };
      break;
    case 'makeAbsorbing':
      next = { ...doc, transitions: replaceRow(doc, cmd.stateId, doc.stateOrder.map((id) => (id === cmd.stateId ? 1 : 0))) };
      break;
    case 'distributeEqually': {
      const n = doc.stateOrder.length;
      next = { ...doc, transitions: replaceRow(doc, cmd.stateId, new Array(n).fill(1 / n)) };
      break;
    }
    case 'normalizeInitial': {
      const byId = new Map(doc.initial.map((e) => [e.stateId, e.probability]));
      const sum = compensatedSum(doc.stateOrder.map((id) => byId.get(id) ?? 0));
      if (!(sum > 0)) return doc;
      next = { ...doc, initial: doc.stateOrder.map((id) => ({ stateId: id, probability: (byId.get(id) ?? 0) / sum })) };
      break;
    }
    case 'setTitle':
      next = { ...doc, title: cmd.title };
      break;
    case 'setStepLabel':
      next = { ...doc, metadata: { ...doc.metadata, stepLabel: cmd.stepLabel || undefined } };
      break;
  }
  return {
    ...next,
    modelRevision: LAYOUT_ONLY.has(cmd.type) ? next.modelRevision : next.modelRevision + 1,
    layoutRevision: LAYOUT_ONLY.has(cmd.type) ? next.layoutRevision + 1 : next.layoutRevision,
    metadata: { ...next.metadata, updatedAt: new Date().toISOString() },
  };
}

/** Rows whose probability or initial mass a state deletion would remove (for the confirmation). */
export function deletionImpact(doc: ChainDocumentV1, id: StateId): { rows: StateId[]; initialMass: number } {
  const rows = doc.transitions.filter((t) => t.to === id && t.from !== id && t.probability > 0).map((t) => t.from);
  const initialMass = doc.initial.find((e) => e.stateId === id)?.probability ?? 0;
  return { rows, initialMass };
}

// ───────────────────────────── Import / export ─────────────────────────────

export function exportDocument(doc: ChainDocumentV1): string {
  return JSON.stringify({ format: 'markov-chain-simulator/project', ...doc }, null, 2);
}

export type ImportResult = { ok: true; document: ChainDocumentV1 } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Runtime schema check — TypeScript types do not validate JSON. */
export function importDocument(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] };
  }
  if (!isObj(raw)) return { ok: false, errors: ['The file does not contain a project object.'] };
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > 1) {
    return { ok: false, errors: ['This project uses a newer file format. Open it in a compatible app version.'] };
  }
  const errors: string[] = [];
  if (raw.schemaVersion !== 1) errors.push('Missing or unknown schemaVersion (expected 1).');
  if (!Array.isArray(raw.states)) errors.push('"states" must be a list.');
  if (!Array.isArray(raw.stateOrder)) errors.push('"stateOrder" must be a list.');
  if (!Array.isArray(raw.transitions)) errors.push('"transitions" must be a list.');
  if (!Array.isArray(raw.initial)) errors.push('"initial" must be a list.');
  if (errors.length) return { ok: false, errors };

  const states = (raw.states as unknown[]).map((s, i) => {
    if (!isObj(s) || typeof s.id !== 'string' || typeof s.label !== 'string') {
      errors.push(`State #${i + 1} needs a string "id" and "label".`);
      return null;
    }
    return { id: s.id, label: s.label, ...(typeof s.description === 'string' ? { description: s.description } : {}) };
  });
  const stateOrder = (raw.stateOrder as unknown[]).filter((v): v is string => typeof v === 'string');
  if (stateOrder.length !== (raw.stateOrder as unknown[]).length) errors.push('"stateOrder" must contain only state IDs.');
  const transitions = (raw.transitions as unknown[]).map((t, i) => {
    if (!isObj(t) || typeof t.from !== 'string' || typeof t.to !== 'string' || !isFiniteNum(t.probability)) {
      errors.push(`Transition #${i + 1} needs "from", "to", and a finite numeric "probability".`);
      return null;
    }
    return { from: t.from, to: t.to, probability: t.probability };
  });
  const initial = (raw.initial as unknown[]).map((e, i) => {
    if (!isObj(e) || typeof e.stateId !== 'string' || !isFiniteNum(e.probability)) {
      errors.push(`Initial entry #${i + 1} needs "stateId" and a finite numeric "probability".`);
      return null;
    }
    return { stateId: e.stateId, probability: e.probability };
  });
  const positions: Record<string, { x: number; y: number }> = {};
  const layout = isObj(raw.layout) && isObj(raw.layout.positions) ? raw.layout.positions : {};
  for (const [id, p] of Object.entries(layout)) {
    if (isObj(p) && isFiniteNum(p.x) && isFiniteNum(p.y)) positions[id] = { x: p.x, y: p.y };
  }
  if (errors.length) return { ok: false, errors };
  // Fill missing initial entries with 0 so every state has exactly one entry.
  const initialIds = new Set(initial.map((e) => e!.stateId));
  const fullInitial = [...initial.map((e) => e!), ...stateOrder.filter((id) => !initialIds.has(id)).map((id) => ({ stateId: id, probability: 0 }))];
  stateOrder.forEach((id, i) => { if (!positions[id]) positions[id] = { x: 120 + (i % 4) * 180, y: 120 + Math.floor(i / 4) * 160 }; });

  const meta = isObj(raw.metadata) ? raw.metadata : {};
  const now = new Date().toISOString();
  return {
    ok: true,
    document: {
      schemaVersion: 1,
      id: typeof raw.id === 'string' ? raw.id : newId('proj'),
      title: typeof raw.title === 'string' ? raw.title : 'Imported model',
      modelRevision: isFiniteNum(raw.modelRevision) ? raw.modelRevision : 0,
      layoutRevision: isFiniteNum(raw.layoutRevision) ? raw.layoutRevision : 0,
      stateOrder,
      states: states.map((s) => s!),
      transitions: transitions.map((t) => t!),
      initial: fullInitial,
      layout: { positions },
      metadata: {
        createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : now,
        updatedAt: typeof meta.updatedAt === 'string' ? meta.updatedAt : now,
        ...(typeof meta.description === 'string' ? { description: meta.description } : {}),
        ...(typeof meta.stepLabel === 'string' ? { stepLabel: meta.stepLabel } : {}),
        ...(typeof meta.exampleId === 'string' ? { exampleId: meta.exampleId } : {}),
        ...(isFiniteNum(meta.exampleVersion) ? { exampleVersion: meta.exampleVersion } : {}),
      },
    },
  };
}
