import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Info, Target } from 'lucide-react';
import {
  absorptionAnalysis, firstArrivalByHorizon, formatProbability, hittingAnalysis, stationaryDistributions,
  type ChainDocumentV1, type CompiledChain, type ScalarResult, type StateId,
} from '../../domain/markov';
import ExplainPanel from '../../components/ExplainPanel';
import { readTokens, type ResolvedTheme } from '../../app/theme';

function scalar(v: ScalarResult, unit = 'steps') {
  if (v.kind === 'infinite') return <strong>Infinite</strong>;
  if (v.kind === 'undefined') return <span className="subtle" title={v.reason}>Not defined</span>;
  return <>{v.value >= 1e6 ? v.value.toExponential(3) : v.value.toFixed(3)} <span className="subtle">{unit}</span></>;
}

export default function AnalysisPage({ doc, chain, stale, theme }: { doc: ChainDocumentV1; chain: CompiledChain | null; stale: boolean; theme: ResolvedTheme }) {
  const label = (id: StateId) => doc.states.find((s) => s.id === id)?.label || 'Unnamed';
  const [targets, setTargets] = useState<StateId[]>([]);
  const [horizon, setHorizon] = useState(30);
  const valid = targets.filter((t) => chain?.stateIds.includes(t));

  const hit = useMemo(() => (chain && valid.length ? hittingAnalysis(chain, valid) : null), [chain, valid.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const arrival = useMemo(() => (chain && valid.length ? firstArrivalByHorizon(chain, valid, horizon) : null), [chain, valid.join(), horizon]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useMemo(() => (chain ? stationaryDistributions(chain) : null), [chain]);
  const ab = useMemo(() => (chain ? absorptionAnalysis(chain) : null), [chain]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tokens = useMemo(() => readTokens(['chart-1', 'chart-grid', 'chart-axis', 'text-muted', 'bg-elevated', 'border', 'text'] as const), [theme]);

  const ids = chain?.stateIds ?? [];
  const notAlmostSure = hit?.status === 'ok' && hit.result.probability.some((p, i) => p < 1 && chain!.initial[i] > 0);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Analysis</div>
          <h1>Long-run and first-passage analysis</h1>
          <p className="muted" style={{ maxWidth: '72ch' }}>
            Exact calculations for “{doc.title}”: communicating classes, stationary behavior, absorption, and the time to reach a set of target states.
            {doc.metadata.stepLabel ? ` One step = one ${doc.metadata.stepLabel}.` : ''}
          </p>
        </div>
      </header>

      <div className="analysis-grid">
        <section className="card" aria-labelledby="structure-h">
          <h2 id="structure-h" className="card-heading">Structure and stationary behavior</h2>
          <ExplainPanel doc={doc} chain={chain} stale={stale} />
        </section>

        <section className="card" aria-labelledby="target-h">
          <h2 id="target-h" className="card-heading"><Target size={18} aria-hidden /> Reaching a target</h2>
          <p className="muted prose" style={{ fontSize: 13 }}>
            Choose a target set A. <strong>Hitting</strong> uses T_A = first t ≥ 0 in A, so starting in A counts as 0 steps. <strong>First return</strong> (t ≥ 1) is a different quantity, listed separately for recurrent states.
          </p>
          <div className="chip-list" role="group" aria-label="Target states" style={{ marginBottom: 12 }}>
            {doc.stateOrder.map((id) => (
              <label key={id} className={`filter-chip${valid.includes(id) ? ' selected' : ''}`}>
                <input type="checkbox" checked={valid.includes(id)} onChange={(e) => setTargets(e.target.checked ? [...valid, id] : valid.filter((t) => t !== id))} />
                {label(id)}
              </label>
            ))}
          </div>

          {!chain ? (
            <div className="callout callout-warning"><AlertTriangle /><p>Fix the model's validation issues to compute target results.</p></div>
          ) : !valid.length ? (
            <div className="empty-state" style={{ padding: 16 }}><p>Select one or more target states.</p></div>
          ) : hit?.status !== 'ok' ? (
            <div className="callout callout-error"><AlertTriangle /><p>{hit && 'issues' in hit ? hit.issues.join(' ') : ''} Calculation could not meet the numerical accuracy target.</p></div>
          ) : (
            <>
              {notAlmostSure && (
                <div className="callout" style={{ marginBottom: 12 }}><Info /><p>The target is not reached with probability 1 from every possible start. Where the probability is below 1, the unconditional expected time is <strong>infinite</strong>; the conditional time (given that A is reached) is shown separately.</p></div>
              )}
              <div className="table-wrap">
                <table className="table">
                  <caption className="visually-hidden">Hitting results for each starting state</caption>
                  <thead>
                    <tr>
                      <th scope="col">Start in</th>
                      <th scope="col" className="numeric">Pr(reach A)</th>
                      <th scope="col" className="numeric">E[T_A]</th>
                      <th scope="col" className="numeric">E[T_A | reach A]</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ids.map((id, i) => (
                      <tr key={id}>
                        <td>{label(id)}{valid.includes(id) && <span className="badge badge-outline" style={{ marginLeft: 6 }}>in A</span>}</td>
                        <td className="numeric">{formatProbability(hit.result.probability[i])}</td>
                        <td className="numeric">{scalar(hit.result.meanTime[i])}</td>
                        <td className="numeric">{scalar(hit.result.conditionalMeanTime[i])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="hint" style={{ marginTop: 6 }}>Method: {hit.method}. Residual {hit.residual?.toExponential(2)}.</p>

              {arrival && (
                <div style={{ marginTop: 16 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <h4 style={{ margin: 0 }}>Pr(T_A ≤ t) from your starting distribution</h4>
                    <label className="row hint" style={{ gap: 6 }}>Horizon
                      <input className="input input-sm num" type="number" min={1} max={2000} value={horizon} style={{ width: 80 }} onChange={(e) => setHorizon(Math.max(1, Math.min(2000, Math.floor(Number(e.target.value) || 1))))} />
                    </label>
                  </div>
                  <div style={{ height: 180 }} role="img" aria-label={`Probability of having reached the target by step t, reaching ${formatProbability(arrival[horizon])} at step ${horizon}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={arrival.map((v, t) => ({ t, v }))} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                        <CartesianGrid stroke={tokens['chart-grid']} vertical={false} />
                        <XAxis dataKey="t" tick={{ fontSize: 11, fill: tokens['text-muted'] }} tickLine={false} axisLine={{ stroke: tokens['chart-axis'] }} />
                        <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={{ fontSize: 11, fill: tokens['text-muted'] }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ background: tokens['bg-elevated'], border: `1px solid ${tokens.border}`, borderRadius: 6, fontSize: 12, color: tokens.text }}
                          labelFormatter={(t) => `By step ${t} · exact`} formatter={(v: number) => [formatProbability(v), 'Pr(T_A ≤ t)']} />
                        <Line dataKey="v" type="stepAfter" stroke={tokens['chart-1']} strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="hint">This is the probability of having <em>arrived</em> by step t. It differs from μₜ(A), the probability of being in A at step t, when the chain can leave A again.</p>
                </div>
              )}
            </>
          )}

          {st?.status === 'ok' && (
            <div style={{ marginTop: 16 }}>
              <h4>First return (t ≥ 1) for recurrent states</h4>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th scope="col">State</th><th scope="col" className="numeric">Mean return time 1/πᵢ</th></tr></thead>
                  <tbody>
                    {ids.map((id, i) => {
                      const v = st.result.extremal.find((e) => e.meanReturn[i] !== undefined)?.meanReturn[i];
                      return <tr key={id}><td>{label(id)}</td><td className="numeric">{v === undefined ? <span className="subtle">Transient — no finite mean return formula</span> : <>{v.toFixed(3)} <span className="subtle">steps</span></>}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {ab?.status === 'ok' && ab.result.transient.length > 0 && (
          <section className="card" aria-labelledby="visits-h">
            <h2 id="visits-h" className="card-heading">Expected visits before absorption</h2>
            <p className="muted prose" style={{ fontSize: 13 }}>N = (I − Q)⁻¹: entry (i, j) is the expected number of times the chain is in transient state j before absorption, starting from i (time 0 counts). Variance of the absorption time is in steps².</p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">From ↓ / Visits to →</th>
                    {ab.result.transient.map((j) => <th key={j} scope="col" className="numeric">{label(ids[j])}</th>)}
                    <th scope="col" className="numeric">E[steps]</th>
                    <th scope="col" className="numeric">Var [steps²]</th>
                  </tr>
                </thead>
                <tbody>
                  {ab.result.transient.map((i, k) => (
                    <tr key={i}>
                      <td>{label(ids[i])}</td>
                      {ab.result.N[k].map((v, j) => <td key={j} className="numeric">{v.toFixed(3)}</td>)}
                      <td className="numeric">{ab.result.t[k].toFixed(3)}</td>
                      <td className="numeric">{ab.result.variance[k].toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint" style={{ marginTop: 6 }}>Method: {ab.method}. Residual {ab.residual?.toExponential(2)}.{ab.warnings.length ? ` ${ab.warnings.join(' ')}` : ''}</p>
          </section>
        )}
      </div>
    </div>
  );
}
