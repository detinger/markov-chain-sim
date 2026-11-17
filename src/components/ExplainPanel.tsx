import { useMemo } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import {
  absorptionAnalysis, formatProbability, stationaryDistributions,
  type ChainDocumentV1, type CompiledChain, type StateId,
} from '../domain/markov';
import { stateColorVar } from './ui';

function fmtSteps(v: number) {
  if (!Number.isFinite(v)) return 'Infinite';
  return v >= 1e6 ? v.toExponential(3) : v.toFixed(v < 100 ? 3 : 1);
}

export default function ExplainPanel({ doc, chain, stale }: { doc: ChainDocumentV1; chain: CompiledChain | null; stale: boolean }) {
  const label = (id: StateId) => doc.states.find((s) => s.id === id)?.label || 'Unnamed';
  const colorIndex = new Map(doc.states.map((s, i) => [s.id, i]));
  const st = useMemo(() => (chain ? stationaryDistributions(chain) : null), [chain]);
  const ab = useMemo(() => (chain ? absorptionAnalysis(chain) : null), [chain]);

  if (!chain) {
    return <div className="empty-state"><h4>Run analysis</h4><p>Create a valid model (every row and the starting distribution total 1) to see its long-run behavior.</p></div>;
  }
  const ids = chain.stateIds;
  const name = (i: number) => label(ids[i]);
  if (!st || st.status !== 'ok') {
    return <div className="callout callout-error"><AlertTriangle /><p>{st && 'issues' in st ? st.issues.join(' ') : 'Analysis failed.'} Your model is saved; inspect numerical details or try a smaller analysis.</p></div>;
  }
  const r = st.result;
  const s = r.structure;
  const closed = s.classes.filter((c) => c.closed);

  return (
    <div>
      {stale && (
        <div className="callout callout-warning stale-banner"><AlertTriangle /><p>These results use an earlier model version. Fix the validation issues to analyze your changes.</p></div>
      )}

      <div className="section">
        <div className="eyebrow">Mathematical status</div>
        <div className="callout" style={{ marginTop: 6 }}><Info /><div>
          <p><strong>{r.summary}</strong></p>
          {!r.convergenceGuaranteed && <p>Stationary distribution exists; convergence is not guaranteed. From this start, μₜ may keep oscillating — the long-run <em>average</em> still approaches the stationary vector.</p>}
        </div></div>
      </div>

      <div className="section">
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Communicating classes</div><div className="kpi-value">{s.classes.length}</div><div className="kpi-detail">{closed.length} closed</div></div>
          <div className="kpi"><div className="kpi-label">Irreducible</div><div className="kpi-value">{s.irreducible ? 'Yes' : 'No'}</div><div className="kpi-detail">{s.transient.length} transient state{s.transient.length === 1 ? '' : 's'}</div></div>
          <div className="kpi"><div className="kpi-label">Absorbing states</div><div className="kpi-value">{s.absorbing.length}</div><div className="kpi-detail">self-loop = 1</div></div>
        </div>
      </div>

      <div className="section">
        <h4>Communicating classes</h4>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">States</th><th scope="col">Type</th><th scope="col" className="numeric">Period</th></tr></thead>
            <tbody>
              {s.classes.map((c, k) => (
                <tr key={k}>
                  <td>{c.states.map(name).join(', ')}</td>
                  <td>{c.closed ? (c.states.length === 1 && s.absorbing.includes(c.states[0]) ? 'Closed · absorbing' : 'Closed · recurrent') : 'Transient'}</td>
                  <td className="numeric">{c.period ?? 'n/a'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 6 }}>Classes come from positive transitions only. A class is closed when no transition leaves it.</p>
      </div>

      <div className="section">
        <h4>{r.unique ? 'Stationary distribution π' : 'Stationary distributions (one per closed class)'}</h4>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">State</th>
                {r.extremal.map((_, k) => <th key={k} scope="col" className="numeric">{r.unique ? 'π' : `π (class ${k + 1})`}</th>)}
                {!r.unique && <th scope="col" className="numeric">From your start</th>}
                <th scope="col" className="numeric">Mean return</th>
              </tr>
            </thead>
            <tbody>
              {ids.map((id, i) => {
                const ret = r.extremal.find((e) => e.meanReturn[i] !== undefined)?.meanReturn[i];
                return (
                  <tr key={id}>
                    <td><span className="swatch" style={{ background: stateColorVar(colorIndex.get(id) ?? 0), marginRight: 6 }} aria-hidden />{label(id)}</td>
                    {r.extremal.map((e, k) => <td key={k} className="numeric">{formatProbability(e.pi[i])}</td>)}
                    {!r.unique && <td className="numeric">{formatProbability(r.mixture[i])}</td>}
                    <td className="numeric">{ret !== undefined ? `${fmtSteps(ret)} steps` : <span className="subtle" title="Transient states have no finite mean return time from the stationary formula">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!r.unique && (
          <p className="hint" style={{ marginTop: 6 }}>
            This model has more than one closed class. Any mixture of the class vectors is stationary. “From your start” weights each class by the probability of ending up there from μ₀
            ({r.classWeights.map((w, k) => `class ${k + 1}: ${formatProbability(w)}`).join(', ')}).
          </p>
        )}
        <p className="hint" style={{ marginTop: 6 }}>Mean return time is 1/πᵢ for states in a closed class: the expected number of steps to come back after leaving.</p>
      </div>

      {ab?.status === 'ok' && ab.result.transient.length > 0 && (
        <div className="section">
          <h4>Absorption</h4>
          <p className="hint">Every path eventually ends in an absorbing state. Values are from each transient starting state.</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">From</th>
                  {ab.result.absorbing.map((a) => <th key={a} scope="col" className="numeric">Ends in {name(a)}</th>)}
                  <th scope="col" className="numeric">Expected steps</th>
                </tr>
              </thead>
              <tbody>
                {ab.result.transient.map((t, i) => (
                  <tr key={t}>
                    <td>{name(t)}</td>
                    {ab.result.B[i].map((v, a) => <td key={a} className="numeric">{formatProbability(v)}</td>)}
                    <td className="numeric" title={`Standard deviation ${Math.sqrt(Math.max(0, ab.result.variance[i])).toFixed(3)} steps`}>{fmtSteps(ab.result.t[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ab.warnings.map((w) => <p key={w} className="hint">{w}</p>)}
        </div>
      )}
      {ab?.status === 'unsupported' && s.absorbing.length > 0 && (
        <div className="callout" style={{ marginBottom: 18 }}><Info /><p>{ab.issues[0]} Absorption tables are shown only when every closed class is a single absorbing state.</p></div>
      )}

      <details>
        <summary className="hint" style={{ cursor: 'pointer' }}>Numerical details</summary>
        <ul className="hint">
          <li>Method: {st.method}</li>
          <li>Residual ‖πP − π‖₁: {st.residual?.toExponential(2) ?? 'n/a'}</li>
          <li>Normalization error: {r.normalizationError.toExponential(2)}</li>
          {ab?.status === 'ok' && <li>Absorption: {ab.method}, residual {ab.residual?.toExponential(2)}</li>}
          <li>Compilation adjustments: {chain.adjustments.length ? chain.adjustments.map((a) => `${a.location} (sum ${a.beforeSum})`).join('; ') : 'none'}</li>
          <li>Model hash: <code>{chain.modelHash}</code></li>
        </ul>
      </details>
    </div>
  );
}
