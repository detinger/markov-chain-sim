import { useState } from 'react';
import { BookOpen, MousePointerClick, Plus, Trash2 } from 'lucide-react';
import {
  compensatedSum, EPS_ROW, formatProbability, formatTotal, rowOf,
  type ChainDocumentV1, type Command, type StateId, type StructureResult,
} from '../domain/markov';
import type { Selection } from '../app/selection';
import { ProbabilityInput } from './MatrixEditor';

interface Props {
  doc: ChainDocumentV1;
  selection: Selection;
  structure: StructureResult | null;
  dispatch: (c: Command, k?: string) => void;
  onSelect: (s: Selection) => void;
  onRequestDelete: (id: StateId) => void;
  onClearDraft: () => void;
  onOpenLesson?: (id: string, title: string) => void;
}

const LESSON_TITLES: Record<string, string> = {
  'foundations.rows': 'Transition probabilities and rows',
  'longrun.classes': 'Communicating classes',
  'absorption.outcomes': 'Absorbing states and eventual outcomes',
};

function RelatedLesson({ id, onOpen }: { id: string; onOpen?: (id: string, title: string) => void }) {
  if (!onOpen) return null;
  return <button className="btn btn-sm btn-ghost" style={{ marginTop: 12 }} onClick={() => onOpen(id, LESSON_TITLES[id])}><BookOpen size={14} aria-hidden /> Related lesson: {LESSON_TITLES[id]}</button>;
}

export default function StateInspector({ doc, selection, structure, dispatch, onSelect, onRequestDelete, onClearDraft, onOpenLesson }: Props) {
  const label = (id: StateId) => doc.states.find((s) => s.id === id)?.label || 'Unnamed';
  const [newTarget, setNewTarget] = useState<StateId>('');

  if (!selection) {
    return (
      <div className="empty-state">
        <MousePointerClick size={28} aria-hidden />
        <h4>Nothing selected</h4>
        <p>Select a state or a transition on the canvas or in the matrix to see what it means and edit it here.</p>
        {doc.stateOrder.length > 0 && (
          <div className="field" style={{ textAlign: 'left', marginTop: 12 }}>
            <label htmlFor="pick-state">Or choose a state</label>
            <select id="pick-state" className="select input-sm" value="" onChange={(e) => onSelect({ kind: 'state', id: e.target.value })}>
              <option value="" disabled>Choose…</option>
              {doc.stateOrder.map((id) => <option key={id} value={id}>{label(id)}</option>)}
            </select>
          </div>
        )}
      </div>
    );
  }

  if (selection.kind === 'transition') {
    const { from, to } = selection;
    const row = rowOf(doc, from);
    const p = row[doc.stateOrder.indexOf(to)] ?? 0;
    const sum = compensatedSum(row);
    return (
      <div>
        <div className="eyebrow">Transition</div>
        <h3>{label(from)} → {label(to)}</h3>
        <p className="muted prose">
          P({label(from)} → {label(to)}) is the probability that a chain currently in <strong>{label(from)}</strong> is in <strong>{label(to)}</strong> one step later.
          {from === to && ' This is a self-loop: the chain stays where it is.'}
        </p>
        <div className="field">
          <label>Probability</label>
          <ProbabilityInput key={`${from}->${to}`} value={p} label={`From ${label(from)} to ${label(to)} probability`} onCommit={(v, k) => { dispatch({ type: 'setProbability', from, to, probability: v }, k); if (v > 0) onClearDraft(); }} />
          <span className="hint">Row total for {label(from)}: {formatTotal(sum)}{Math.abs(sum - 1) > EPS_ROW ? ' — rows must total 1.' : '.'}</span>
        </div>
        <div className="row">
          <button className="btn btn-sm" onClick={() => onSelect({ kind: 'state', id: from })}>Open {label(from)}</button>
          {p > 0 && <button className="btn btn-sm btn-danger" onClick={() => dispatch({ type: 'setProbability', from, to, probability: 0 })}><Trash2 size={14} /> Remove transition</button>}
        </div>
        <p className="hint" style={{ marginTop: 12 }}>Common mistake: reading the matrix by column. Probabilities out of a state are in its <em>row</em>.</p>
        <RelatedLesson id="foundations.rows" onOpen={onOpenLesson} />
      </div>
    );
  }

  const id = selection.id;
  const state = doc.states.find((s) => s.id === id);
  if (!state) return null;
  const row = rowOf(doc, id);
  const sum = compensatedSum(row);
  const idx = doc.stateOrder.indexOf(id);
  const cls = structure ? structure.classes[structure.classOf[idx]] : null;
  const absorbing = structure?.absorbing.includes(idx);
  const unreachable = structure && !structure.reachableFromInitial[idx];
  const candidates = doc.stateOrder.filter((t) => (row[doc.stateOrder.indexOf(t)] ?? 0) === 0);

  return (
    <div>
      <div className="eyebrow">State</div>
      <div className="field">
        <label htmlFor="state-name">Name</label>
        <input id="state-name" className="input" key={id} defaultValue={state.label}
          onBlur={(e) => e.target.value.trim() && e.target.value !== state.label && dispatch({ type: 'renameState', id, label: e.target.value.trim() })}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        {absorbing && <span className="badge badge-outline">Absorbing</span>}
        {cls && !absorbing && <span className="badge badge-outline">{cls.closed ? 'Recurrent' : 'Transient'}</span>}
        {cls?.closed && cls.period && cls.period > 1 && <span className="badge badge-outline">Period {cls.period}</span>}
        {unreachable && <span className="badge">Not reachable from start</span>}
        {Math.abs(sum - 1) > EPS_ROW && <span className="badge badge-error">Row total {formatTotal(sum)}</span>}
      </div>
      <p className="muted prose" style={{ fontSize: 13 }}>
        {absorbing ? 'Once the chain enters this state it never leaves: its only outgoing transition is a self-loop with probability 1.'
          : cls?.closed ? 'The chain can leave this state but always comes back eventually: no positive-probability path leaves its closed class.'
          : cls ? 'Transient: there is a positive probability of leaving and never returning.' : 'Fix validation issues to see this state’s classification.'}
      </p>

      <h4>Outgoing row</h4>
      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="table">
          <thead><tr><th scope="col">To</th><th scope="col" className="numeric">Probability</th></tr></thead>
          <tbody>
            {doc.stateOrder.map((to, j) => row[j] > 0 && (
              <tr key={to} onClick={() => onSelect({ kind: 'transition', from: id, to })} style={{ cursor: 'pointer' }}>
                <td>{label(to)}</td><td className="numeric">{formatProbability(row[j])}</td>
              </tr>
            ))}
            <tr><th scope="row">Total</th><td className="numeric"><strong>{formatTotal(sum)}</strong></td></tr>
          </tbody>
        </table>
      </div>

      <h4>Add transition</h4>
      <p className="hint">Keyboard alternative to dragging between states on the canvas.</p>
      <div className="row" style={{ marginBottom: 16 }}>
        <label className="visually-hidden" htmlFor="new-target">Destination</label>
        <select id="new-target" className="select input-sm" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} style={{ flex: 1 }}>
          <option value="">Choose destination…</option>
          {candidates.map((t) => <option key={t} value={t}>{t === id ? `${label(t)} (self-loop)` : label(t)}</option>)}
        </select>
        <button className="btn btn-sm" disabled={!newTarget} onClick={() => { onSelect({ kind: 'transition', from: id, to: newTarget }); setNewTarget(''); }}>
          <Plus size={14} /> Add
        </button>
      </div>

      <div className="row">
        <button className="btn btn-sm" onClick={() => dispatch({ type: 'setSingleStart', stateId: id })}>Start here</button>
        <button className="btn btn-sm" onClick={() => dispatch({ type: 'makeAbsorbing', stateId: id })} disabled={absorbing}>Make absorbing</button>
        <button className="btn btn-sm btn-danger" onClick={() => onRequestDelete(id)}><Trash2 size={14} /> Delete state</button>
      </div>
      <RelatedLesson id={absorbing ? 'absorption.outcomes' : cls ? 'longrun.classes' : 'foundations.rows'} onOpen={onOpenLesson} />
    </div>
  );
}
