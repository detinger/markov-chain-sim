import { useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  compensatedSum, EPS_ROW, formatProbability, formatSigned, formatTotal, initialVector, parseProbability, rowOf,
  type ChainDocumentV1, type Command, type StateId,
} from '../domain/markov';
import type { Selection } from '../app/selection';

interface ProbabilityInputProps {
  value: number;
  label: string;
  selected?: boolean;
  onCommit: (value: number, coalesceKey: string) => void;
  onFocus?: () => void;
  inputRef?: (el: HTMLInputElement | null) => void;
}

/** Edit buffer for one probability: drafts and invalid text never reach the model (PLAN.md §4.2). */
export function ProbabilityInput({ value, label, onCommit, onFocus, inputRef }: ProbabilityInputProps) {
  const [text, setText] = useState<string | null>(null);
  const original = useRef(value);
  const session = useRef('');
  const errorId = useId();
  const parsed = text === null ? null : parseProbability(text);
  const problem = parsed && parsed.kind !== 'value' ? parsed.message : null;

  return (
    <>
      <input
        ref={inputRef}
        className={`input cell-input${value === 0 && text === null ? ' zero' : ''}`}
        inputMode="decimal"
        aria-label={label}
        aria-invalid={parsed?.kind === 'invalid' || undefined}
        aria-describedby={problem ? errorId : undefined}
        value={text ?? formatProbability(value)}
        title={text === null ? String(value) : undefined}
        onFocus={(e) => {
          original.current = value;
          session.current = `${label}-${Date.now()}`;
          setText(String(value));
          onFocus?.();
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => {
          setText(e.target.value);
          const p = parseProbability(e.target.value);
          if (p.kind === 'value' && p.value !== value) onCommit(p.value, session.current);
        }}
        onBlur={() => {
          if (parsed?.kind === 'value' || parsed === null) setText(null);
          else if (parsed.kind === 'draft') setText(null); // empty/incomplete: keep the last committed value
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            if (value !== original.current) onCommit(original.current, session.current);
            setText(null);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {problem && text !== null && <span id={errorId} className="visually-hidden">{problem}</span>}
    </>
  );
}

interface MatrixEditorProps {
  doc: ChainDocumentV1;
  selection: Selection;
  onSelect: (s: Selection) => void;
  dispatch: (c: Command, coalesceKey?: string) => void;
  cellRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}

export default function MatrixEditor({ doc, selection, onSelect, dispatch, cellRefs }: MatrixEditorProps) {
  const label = (id: StateId) => doc.states.find((s) => s.id === id)?.label || 'Unnamed';
  const [typingError, setTypingError] = useState<string | null>(null);

  if (doc.stateOrder.length === 0) {
    return <div className="empty-state"><h4>No states yet</h4><p>Create your first state, or open an example to explore a working model.</p></div>;
  }

  const selFrom = selection?.kind === 'transition' ? selection.from : selection?.kind === 'state' ? selection.id : null;
  const selTo = selection?.kind === 'transition' ? selection.to : null;

  return (
    <div>
      <div className="table-wrap" onInput={(e) => {
        const p = parseProbability((e.target as HTMLInputElement).value);
        setTypingError(p.kind === 'invalid' ? p.message : null);
      }}>
        <table className="table matrix">
          <caption className="visually-hidden">Transition matrix: rows are the current state (From), columns are the next state (To).</caption>
          <thead>
            <tr>
              <th className="corner" scope="col">From ↓ / To →</th>
              {doc.stateOrder.map((id) => (
                <th key={id} scope="col" className={selTo === id ? 'col-selected' : ''} title={label(id)}>{label(id)}</th>
              ))}
              <th scope="col" className="numeric">Total</th>
            </tr>
          </thead>
          <tbody>
            {doc.stateOrder.map((from) => {
              const row = rowOf(doc, from);
              const sum = compensatedSum(row);
              const valid = Math.abs(sum - 1) <= EPS_ROW;
              return (
                <tr key={from} className={`${valid ? '' : 'row-invalid'} ${selFrom === from ? 'row-selected' : ''}`}>
                  <th scope="row" title={label(from)}>{label(from)}</th>
                  {doc.stateOrder.map((to, j) => {
                    const key = `${from}->${to}`;
                    const isSel = selection?.kind === 'transition' && selection.from === from && selection.to === to;
                    return (
                      <td key={to} className={isSel ? 'selected' : ''}>
                        <ProbabilityInput
                          value={row[j]}
                          label={`From ${label(from)} to ${label(to)} probability`}
                          inputRef={(el) => { cellRefs.current[key] = el; }}
                          onFocus={() => onSelect({ kind: 'transition', from, to })}
                          onCommit={(v, k) => dispatch({ type: 'setProbability', from, to, probability: v }, k)}
                        />
                      </td>
                    );
                  })}
                  <td className="total">
                    {valid ? (
                      <span className="badge badge-success" title="Row totals 1"><CheckCircle2 size={12} aria-hidden /> 1</span>
                    ) : (
                      <span className="badge badge-error" title={`Total ${formatTotal(sum)} (${formatSigned(sum - 1)})`}>
                        <AlertCircle size={12} aria-hidden /> {formatTotal(sum)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {typingError && <div className="cell-error" role="alert"><AlertCircle size={14} /> {typingError}</div>}
      <p className="hint" style={{ marginTop: 8 }}>
        Each row lists where the chain goes next from that state; rows must total exactly 1. Setting a cell to 0 removes that transition. Type, then press <kbd>Enter</kbd>; <kbd>Esc</kbd> restores the value you started with.
      </p>
    </div>
  );
}

export function InitialDistributionEditor({ doc, dispatch }: { doc: ChainDocumentV1; dispatch: (c: Command, k?: string) => void }) {
  const mu = initialVector(doc);
  const single = mu.filter((v) => v > 0).length === 1 && mu.some((v) => v === 1);
  const [custom, setCustom] = useState(!single);
  const sum = compensatedSum(mu);
  const valid = Math.abs(sum - 1) <= EPS_ROW;
  const label = (id: StateId) => doc.states.find((s) => s.id === id)?.label || 'Unnamed';
  if (!doc.stateOrder.length) return null;
  const startId = doc.stateOrder[mu.findIndex((v) => v === 1)] ?? '';

  return (
    <div>
      <div className="segmented" role="group" aria-label="Starting distribution mode" style={{ marginBottom: 10 }}>
        <button className="btn btn-sm" aria-pressed={!custom} onClick={() => { setCustom(false); if (!single) dispatch({ type: 'setSingleStart', stateId: doc.stateOrder[Math.max(0, mu.indexOf(Math.max(...mu)))] }); }}>Single starting state</button>
        <button className="btn btn-sm" aria-pressed={custom} onClick={() => setCustom(true)}>Custom distribution</button>
      </div>
      {!custom ? (
        <div className="field">
          <label htmlFor="start-state">Starting state</label>
          <select id="start-state" className="select input-sm" value={startId} onChange={(e) => dispatch({ type: 'setSingleStart', stateId: e.target.value })}>
            {!startId && <option value="" disabled>Choose a state…</option>}
            {doc.stateOrder.map((id) => <option key={id} value={id}>{label(id)}</option>)}
          </select>
          <span className="hint">The chain is in this state at step 0 with probability 1.</span>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table matrix">
              <caption className="visually-hidden">Starting distribution μ₀</caption>
              <thead><tr><th scope="col">State</th><th scope="col" className="numeric">μ₀</th></tr></thead>
              <tbody>
                {doc.stateOrder.map((id, i) => (
                  <tr key={id}>
                    <th scope="row">{label(id)}</th>
                    <td className="numeric">
                      <ProbabilityInput value={mu[i]} label={`Starting probability of ${label(id)}`} onCommit={(v, k) => dispatch({ type: 'setInitial', stateId: id, probability: v }, k)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <span className="field-label">Starting total</span>
            {valid
              ? <span className="badge badge-success"><CheckCircle2 size={12} aria-hidden /> 1</span>
              : <span className="badge badge-error"><AlertCircle size={12} aria-hidden /> {formatTotal(sum)}</span>}
            {!valid && sum > 0 && <button className="btn btn-sm" onClick={() => dispatch({ type: 'normalizeInitial' })}>Normalize</button>}
          </div>
        </>
      )}
    </div>
  );
}
