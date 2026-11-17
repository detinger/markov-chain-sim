import { Fragment, useEffect, useState } from 'react';
import { ArrowRight, Info, Trash2, Undo2, X } from 'lucide-react';
import { formatProbability, pathProbability, type ChainDocumentV1, type CompiledChain, type PathMode, type StateId } from '../domain/markov';
import { stateColorVar } from './ui';

interface Props {
  doc: ChainDocumentV1;
  chain: CompiledChain | null;
}

export default function SequenceCalculator({ doc, chain }: Props) {
  const [sequence, setSequence] = useState<StateId[]>([]);
  const [mode, setMode] = useState<PathMode>('joint');
  const label = (id: StateId) => doc.states.find((s) => s.id === id)?.label || 'Unnamed';
  const colorIndex = new Map(doc.states.map((s, i) => [s.id, i]));

  // Never silently retarget a path by index: drop references to deleted states and say so.
  const missing = sequence.filter((id) => !doc.stateOrder.includes(id));
  useEffect(() => {
    if (missing.length) setSequence((s) => s.filter((id) => doc.stateOrder.includes(id)));
  }, [missing.length, doc.stateOrder]);

  const outcome = chain && sequence.length ? pathProbability(chain, sequence, mode) : null;
  const result = outcome?.status === 'ok' ? outcome.result : null;
  const zeroAt = result?.firstZeroFactor ?? -1;
  const zeroFactor = result && zeroAt >= 0 ? result.factors[zeroAt] : null;
  // Chip index that becomes impossible (transition factors map to chip k+1; initial factor maps to chip 0).
  const impossibleChip = zeroFactor ? (zeroFactor.kind === 'initial' ? 0 : zeroAt + (mode === 'joint' ? 0 : 1)) : -1;

  return (
    <div className="stack">
      <div className="segmented" role="group" aria-label="Probability type">
        <button className="btn btn-sm" aria-pressed={mode === 'joint'} onClick={() => setMode('joint')}>Joint probability</button>
        <button className="btn btn-sm" aria-pressed={mode === 'conditional'} onClick={() => setMode('conditional')}>Given starting state</button>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        {mode === 'joint'
          ? 'Pr(X₀ = first, …, Xₖ = last): includes the starting probability μ₀ of the first state.'
          : 'Pr(X₁, …, Xₖ | X₀ = first): assumes the chain starts in the first state and multiplies only transitions.'}
      </p>

      <div className="path-box" aria-label="Path">
        {sequence.length === 0 && <span className="hint">Click states below to build a path, for example Sunny → Rainy → Rainy.</span>}
        {sequence.map((id, idx) => (
          <Fragment key={`${id}-${idx}`}>
            <span className={`chip${idx === impossibleChip ? ' impossible' : ''}`}>
              <span className="swatch" style={{ background: stateColorVar(colorIndex.get(id) ?? 0) }} aria-hidden />
              {label(id)}
              <button onClick={() => setSequence((s) => s.filter((_, i) => i !== idx))} aria-label={`Remove step ${idx} (${label(id)})`}><X size={12} /></button>
            </span>
            {idx < sequence.length - 1 && <ArrowRight size={14} aria-hidden className="subtle" />}
          </Fragment>
        ))}
      </div>

      <div className="row" role="group" aria-label="Add a state to the path">
        {doc.stateOrder.map((id) => (
          <button key={id} className="btn btn-sm" onClick={() => setSequence((s) => [...s, id])}>+ {label(id)}</button>
        ))}
      </div>
      <div className="row">
        <button className="btn btn-sm btn-ghost" disabled={!sequence.length} onClick={() => setSequence((s) => s.slice(0, -1))}><Undo2 size={14} /> Undo last state</button>
        <button className="btn btn-sm btn-ghost btn-danger" disabled={!sequence.length} onClick={() => setSequence([])}><Trash2 size={14} /> Clear sequence</button>
      </div>

      {!chain && sequence.length > 0 && (
        <div className="callout callout-warning"><Info /><p>Fix the issues in Validate before calculating. Your path is kept.</p></div>
      )}

      {result && (
        <div className="result-card" aria-live="polite">
          <div className="kpi-label">{mode === 'joint' ? 'Joint probability of this path' : 'Probability of this path given the start'}</div>
          <div className="kpi-value">
            {result.underflow ? `< ${Number.MIN_VALUE.toExponential(0)}` : formatProbability(result.probability, 6)}
          </div>
          <div className="kpi-detail">
            Calculated from the model · {result.transitions} transition{result.transitions === 1 ? '' : 's'}
            {Number.isFinite(result.logProbability) && ` · ln p = ${result.logProbability.toFixed(4)}`}
          </div>
          {result.factors.length > 0 ? (
            <div className="factor-list" style={{ marginTop: 8 }} aria-label="Factors">
              {result.factors.map((f, i) => (
                <span key={i} className={f.value === 0 ? 'zero' : ''}>
                  {i > 0 && '× '}
                  {f.kind === 'initial' ? `μ₀(${label(f.to)})` : `P(${label(f.from!)}→${label(f.to)})`}={formatProbability(f.value)}
                </span>
              ))}
            </div>
          ) : (
            <p className="hint" style={{ margin: '8px 0 0' }}>A one-state path has no transitions, so the conditional probability is 1.</p>
          )}
          {zeroFactor && (
            <div className="callout" style={{ marginTop: 8 }}><Info />
              <p>{zeroFactor.kind === 'initial'
                ? `Impossible: the starting distribution gives ${label(zeroFactor.to)} probability 0.`
                : `Impossible at step ${zeroAt + (mode === 'joint' ? 0 : 1)}: there is no transition from ${label(zeroFactor.from!)} to ${label(zeroFactor.to)}.`}</p>
            </div>
          )}
          {result.underflow && <p className="hint" style={{ margin: '8px 0 0' }}>Positive, but smaller than the smallest displayable number. This path is possible, just very unlikely.</p>}
          {result.counterfactualStart && (
            <p className="hint" style={{ margin: '8px 0 0' }}>The starting distribution gives {label(sequence[0])} zero probability; this is a “what if it started here” calculation.</p>
          )}
        </div>
      )}
    </div>
  );
}
