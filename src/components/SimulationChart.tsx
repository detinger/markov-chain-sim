import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { evolveDistribution, formatProbability, type ChainDocumentV1, type CompiledChain, type StateId } from '../domain/markov';
import { readTokens, type ResolvedTheme } from '../app/theme';
import { CHART_TOKENS } from './ui';

interface Props {
  doc: ChainDocumentV1;
  chain: CompiledChain | null;
  stale: boolean;
  theme: ResolvedTheme;
}

/** Exact distribution μₜ = μ₀Pᵗ (PLAN.md B09, Module D mode 2). Not a random simulation. */
export default function DistributionView({ doc, chain, stale, theme }: Props) {
  const [horizon, setHorizon] = useState(20);
  const [step, setStep] = useState(1);
  const label = (id: StateId) => doc.states.find((s) => s.id === id)?.label || 'Unnamed';
  const colorIndex = new Map(doc.states.map((s, i) => [s.id, i]));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tokens = useMemo(() => readTokens([...CHART_TOKENS, 'chart-grid', 'chart-axis', 'text-muted', 'bg-elevated', 'border', 'text', 'primary'] as const), [theme]);
  const series = useMemo(() => {
    if (!chain) return null;
    const out = evolveDistribution(chain, horizon);
    return out.status === 'ok' ? out.result : null;
  }, [chain, horizon]);

  const data = series?.map((mu, t) => ({ t, ...Object.fromEntries(chain!.stateIds.map((id, i) => [id, mu[i]])) }));
  const shown = Math.min(step, horizon);
  const unit = doc.metadata.stepLabel ? `${doc.metadata.stepLabel}s` : 'steps';

  if (!series || !data) {
    return <div className="empty-state" style={{ gridColumn: '1 / -1' }}><p>{doc.stateOrder.length === 0 ? 'Add a state or open an example to see how the distribution evolves.' : 'Choose a starting state or enter a distribution that totals 1, and make every row total 1.'}</p></div>;
  }
  return (
            <>
              <div>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="hint">μₜ = μ₀Pᵗ · probability of being in each state after t {unit}</span>
                  <label className="row hint" style={{ gap: 6 }}>
                    Horizon
                    <input className="input input-sm num" type="number" min={0} max={500} value={horizon} style={{ width: 72 }}
                      onChange={(e) => setHorizon(Math.max(0, Math.min(500, Math.floor(Number(e.target.value) || 0))))} />
                  </label>
                </div>
                {stale && <p className="hint" style={{ color: 'var(--warning)' }}>These results use an earlier model version.</p>}
                <div className="chart-box" role="img" aria-label={`Line chart of state probabilities from step 0 to ${horizon}. The table beside it lists exact values.`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                      <CartesianGrid stroke={tokens['chart-grid']} vertical={false} />
                      <XAxis dataKey="t" tick={{ fontSize: 11, fill: tokens['text-muted'] }} tickLine={false} axisLine={{ stroke: tokens['chart-axis'] }} />
                      <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={{ fontSize: 11, fill: tokens['text-muted'] }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: tokens['bg-elevated'], border: `1px solid ${tokens.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 12, color: tokens.text }}
                        labelFormatter={(t) => `Step ${t} · exact`}
                        formatter={(v: number, key) => [formatProbability(v), label(String(key))]}
                      />
                      <ReferenceLine x={shown} stroke={tokens.primary} strokeDasharray="3 3" />
                      {chain!.stateIds.map((id) => {
                        const c = tokens[CHART_TOKENS[(colorIndex.get(id) ?? 0) % CHART_TOKENS.length]];
                        return <Line key={id} type="linear" dataKey={id} name={label(id)} stroke={c} strokeWidth={2} dot={{ r: 2, fill: c, strokeWidth: 0 }} isAnimationActive={false} />;
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="row" style={{ fontSize: 12 }}>
                  {chain!.stateIds.map((id) => (
                    <span key={id} className="row" style={{ gap: 4 }}>
                      <span className="swatch" style={{ background: tokens[CHART_TOKENS[(colorIndex.get(id) ?? 0) % CHART_TOKENS.length]] }} aria-hidden />{label(id)}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="field" style={{ marginBottom: 6 }}>
                  <span className="field-label">Step t = <span className="num">{shown}</span></span>
                  <input type="range" min={0} max={horizon} value={shown} onChange={(e) => setStep(Number(e.target.value))} aria-label="Step" />
                </label>
                <div className="table-wrap">
                  <table className="table">
                    <caption className="visually-hidden">Exact distribution at step {shown}</caption>
                    <thead><tr><th scope="col">State</th><th scope="col" className="numeric">μ{shown === 0 ? '₀' : 'ₜ'}</th>{shown > 0 && <th scope="col" className="numeric">μₜ₋₁</th>}</tr></thead>
                    <tbody>
                      {chain!.stateIds.map((id, i) => (
                        <tr key={id}>
                          <td>{label(id)}</td>
                          <td className="numeric">{formatProbability(series[shown][i])}</td>
                          {shown > 0 && <td className="numeric subtle">{formatProbability(series[shown - 1][i])}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {shown > 0 && (
                  <p className="hint" style={{ marginTop: 6 }}>
                    One step: μₜ[j] = Σᵢ μₜ₋₁[i]·P[i][j] — add up every way of arriving in j. These are probabilities, not counts of tokens.
                  </p>
                )}
              </div>
            </>
  );
}
