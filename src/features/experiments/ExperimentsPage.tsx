import { useMemo, useState } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Dices, Download, FlaskConical, Info, Play, Square } from 'lucide-react';
import { formatProbability, type ChainDocumentV1, type CompiledChain, type StateId } from '../../domain/markov';
import {
  buildRunBundle, experimentToCsv, MAX_HORIZON, MAX_REPLICATIONS, parseSeed, RNG_ALGORITHM, validateExperimentConfig,
  type ExperimentConfig,
} from '../../domain/simulation';
import type { Interval } from '../../domain/statistics';
import { readTokens, type ResolvedTheme } from '../../app/theme';
import { CHART_TOKENS, stateColorVar } from '../../components/ui';
import type { useExperiment } from './useExperiment';

type Experiment = ReturnType<typeof useExperiment>;

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
/** Interval endpoints: enough digits that a bound below 100% never prints as 100%. */
const pctBound = (v: number) => (v === 0 || v === 1 ? `${v * 100}%` : `${(v * 100).toFixed(v > 0.999 || v < 0.001 ? 3 : 2)}%`);
const fmtSe = (v: number) => (!Number.isFinite(v) ? '—' : v === 0 ? '0' : v < 1e-4 ? v.toExponential(1) : v.toFixed(4));
const ci = (iv: Interval | null | undefined, f = formatProbability) => (iv ? `${f(iv.lower)} – ${f(iv.upper)}` : 'No interval (n < 2)');
const num = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : 'Not defined');

export default function ExperimentsPage({ doc, chain, experiment, theme }: {
  doc: ChainDocumentV1; chain: CompiledChain | null; experiment: Experiment; theme: ResolvedTheme;
}) {
  const label = (id: StateId) => doc.states.find((s) => s.id === id)?.label || 'Unnamed';
  const [seedText, setSeedText] = useState(() => String(Math.floor(Math.random() * 1e6)));
  const [replications, setReplications] = useState(1000);
  const [horizon, setHorizon] = useState(50);
  const [burnIn, setBurnIn] = useState(0);
  const [start, setStart] = useState<'mu0' | StateId>('mu0');
  const [targets, setTargets] = useState<StateId[]>([]);
  const validTargets = targets.filter((t) => doc.stateOrder.includes(t));

  const seed = parseSeed(seedText);
  const config: ExperimentConfig | null = chain && seed !== null ? {
    schemaVersion: 1, modelHash: chain.modelHash, seed, replications, horizon, burnIn: Math.min(burnIn, horizon),
    targetIds: validTargets, traceLimit: 10,
    ...(start !== 'mu0' && chain.stateIds.includes(start) ? { initial: chain.stateIds.map((id) => (id === start ? 1 : 0)) } : {}),
  } : null;
  const errors = chain && config ? validateExperimentConfig(chain, config) : [];
  const running = experiment.status === 'running' || experiment.status === 'cancelling';
  const r = experiment.result;
  const stale = !!r && (!chain || r.chain.modelHash !== chain.modelHash);

  return (
    <div className="page page-wide">
      <header className="page-header">
        <div>
          <div className="eyebrow">Experiments</div>
          <h1>Monte Carlo experiment</h1>
          <p className="muted" style={{ maxWidth: '72ch' }}>
            Run many independent random trajectories of “{doc.title}” and compare the estimates with exact calculations. Each trajectory uses its own random stream, so the same seed always reproduces the same results.
          </p>
        </div>
      </header>

      <div className="config-results">
        <section className="card config-column" aria-label="Experiment configuration">
          <h3>Configuration</h3>
          {!chain && <div className="callout callout-warning" style={{ marginBottom: 12 }}><AlertTriangle /><p>Fix the model's validation issues in the modeler before running an experiment.</p></div>}
          <div className="field-row">
            <label className="field"><span className="field-label">Replications M</span>
              <input className="input num" type="number" min={1} max={MAX_REPLICATIONS} value={replications} onChange={(e) => setReplications(Math.max(1, Math.min(MAX_REPLICATIONS, Math.floor(Number(e.target.value) || 1))))} />
              <span className="hint">Independent trajectories</span>
            </label>
            <label className="field"><span className="field-label">Horizon H</span>
              <input className="input num" type="number" min={0} max={MAX_HORIZON} value={horizon} onChange={(e) => setHorizon(Math.max(0, Math.min(MAX_HORIZON, Math.floor(Number(e.target.value) || 0))))} />
              <span className="hint">{horizon} transitions, {horizon + 1} states</span>
            </label>
          </div>
          <label className="field"><span className="field-label">Seed</span>
            <span className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
              <input className="input num" style={{ flex: 1 }} value={seedText} aria-invalid={seed === null || undefined} onChange={(e) => setSeedText(e.target.value)} />
              <button className="btn btn-icon" aria-label="New random seed" onClick={() => setSeedText(String(crypto.getRandomValues(new Uint32Array(1))[0]))}><Dices size={16} /></button>
            </span>
            {seed === null && <span className="hint" style={{ color: 'var(--error)' }}>Whole number 0–4294967295</span>}
          </label>
          <label className="field"><span className="field-label">Start</span>
            <select className="select" value={start} onChange={(e) => setStart(e.target.value)}>
              <option value="mu0">Sample X₀ from the model's μ₀</option>
              {doc.stateOrder.map((id) => <option key={id} value={id}>Always start in {label(id)}</option>)}
            </select>
          </label>
          <fieldset className="field target-set">
            <legend className="field-label">Target set A (first hit)</legend>
            <div className="chip-list">
              {doc.stateOrder.map((id) => (
                <label key={id} className={`filter-chip${validTargets.includes(id) ? ' selected' : ''}`}>
                  <input type="checkbox" checked={validTargets.includes(id)} onChange={(e) => setTargets(e.target.checked ? [...validTargets, id] : validTargets.filter((t) => t !== id))} />
                  {label(id)}
                </label>
              ))}
            </div>
            <span className="hint">T_A is the first step t ≥ 0 at which the path is in A. Paths keep running after a hit, so occupancy stays valid.</span>
          </fieldset>
          <label className="field"><span className="field-label">Occupancy burn-in b</span>
            <input className="input num" type="number" min={0} max={horizon} value={Math.min(burnIn, horizon)} onChange={(e) => setBurnIn(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
            <span className="hint">Visit fractions count t = b…H. Burn-in never removes early hits and does not prove convergence.</span>
          </label>
          {errors.length > 0 && <div className="callout callout-error" style={{ marginBottom: 12 }}><AlertTriangle /><p>{errors.join(' ')}</p></div>}
          {running ? (
            <button className="btn" style={{ width: '100%' }} onClick={experiment.cancel} disabled={experiment.status === 'cancelling'}><Square size={14} /> {experiment.status === 'cancelling' ? 'Cancelling…' : 'Cancel experiment'}</button>
          ) : (
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={!chain || !config || errors.length > 0}
              onClick={() => chain && config && experiment.run(chain, config, Object.fromEntries(doc.states.map((s) => [s.id, s.label])))}>
              <Play size={16} /> Run experiment
            </button>
          )}
          {running && (
            <div style={{ marginTop: 12 }}>
              <div className="progress" role="progressbar" aria-label="Experiment progress" aria-valuemin={0} aria-valuemax={experiment.progress.total} aria-valuenow={experiment.progress.completed}>
                <div className="progress-fill" style={{ width: `${(experiment.progress.completed / Math.max(1, experiment.progress.total)) * 100}%` }} />
              </div>
              <p className="hint" style={{ marginTop: 4 }}>Simulating {experiment.progress.completed.toLocaleString()} of {experiment.progress.total.toLocaleString()} trajectories in a background worker…</p>
            </div>
          )}
          {experiment.status === 'error' && <div className="callout callout-error" style={{ marginTop: 12 }}><AlertTriangle /><p>{experiment.error}</p></div>}
        </section>

        <section className="results-column" aria-label="Results" aria-live="polite">
          {!r ? (
            <div className="card empty-state">
              <FlaskConical size={32} aria-hidden />
              <h4>No results yet</h4>
              <p>Choose how many trajectories to simulate and for how many steps, optionally pick target states, then run the experiment.</p>
            </div>
          ) : (
            <Results result={r} stale={stale} theme={theme} />
          )}
        </section>
      </div>
    </div>
  );
}

function Results({ result: r, stale, theme }: { result: NonNullable<Experiment['result']>; stale: boolean; theme: ResolvedTheme }) {
  const { summary: s, config, chain } = r;
  const ids = chain.stateIds;
  const name = (i: number) => r.labels[ids[i]] ?? ids[i];
  const colorIndex = new Map(Object.keys(r.labels).map((id, i) => [id, i]));
  const [stateIdx, setStateIdx] = useState(0);
  const [t, setT] = useState(config.horizon);
  const shownT = Math.min(t, config.horizon);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tokens = useMemo(() => readTokens([...CHART_TOKENS, 'chart-grid', 'chart-axis', 'text-muted', 'bg-elevated', 'border', 'text', 'accent', 'chart-muted'] as const), [theme]);
  const color = tokens[CHART_TOKENS[(colorIndex.get(ids[stateIdx]) ?? stateIdx) % CHART_TOKENS.length]];

  const series = s.endpoint.map((row, time) => {
    const iv = row[stateIdx];
    return { t: time, est: iv?.estimate, band: iv ? [iv.lower, iv.upper] : undefined, exact: s.exactEndpoint[time]?.[stateIdx] };
  });
  const labelOf = (id: StateId) => r.labels[id] ?? id;
  const unitNote = `${s.completed.toLocaleString()} independent trajectories · seed ${config.seed} · H = ${config.horizon} · ${RNG_ALGORITHM}`;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="hint">{unitNote} · {(r.elapsedMs / 1000).toFixed(2)} s</div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-sm" onClick={() => download(`experiment-seed-${config.seed}.csv`, experimentToCsv(chain, config, s, labelOf), 'text/csv')}><Download size={14} /> CSV</button>
          <button className="btn btn-sm" onClick={() => download(`experiment-seed-${config.seed}.run.json`, JSON.stringify(buildRunBundle(chain, config, r.acc, s, r.labels, r.startedAt, r.finishedAt), null, 2), 'application/json')}><Download size={14} /> Run bundle</button>
        </div>
      </div>
      {stale && <div className="callout callout-warning"><AlertTriangle /><p>These results use an earlier model version. Run again to analyze your changes.</p></div>}
      {s.partial && <div className="callout callout-warning"><AlertTriangle /><p><strong>Partial results.</strong> The experiment was cancelled after {s.completed.toLocaleString()} of {s.requested.toLocaleString()} trajectories. Estimates and intervals use only the completed trajectories.</p></div>}

      {s.hitting && (
        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi-label">Hit A by step {config.horizon}</div>
            <div className="kpi-value">{pct(s.hitting.hitByHorizon?.estimate ?? 0)}</div>
            <div className="kpi-detail">95% CI {ci(s.hitting.hitByHorizon, pctBound)} · exact {pctBound(s.hitting.exactHitByHorizon)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Censored (no hit by {config.horizon})</div>
            <div className="kpi-value">{s.hitting.censoredCount.toLocaleString()}</div>
            <div className="kpi-detail">of {s.completed.toLocaleString()} trajectories</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Restricted mean E[min(T_A, H)]</div>
            <div className="kpi-value">{num(s.hitting.restrictedMean.mean)} <small className="kpi-unit">steps</small></div>
            <div className="kpi-detail">95% CI {ci(s.hitting.restrictedMean.interval, (v) => v.toFixed(2))} · exact {s.hitting.exactRestrictedMean.toFixed(2)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Mean among hits (conditional)</div>
            <div className="kpi-value">{s.hitting.meanAmongHits === null ? 'Not defined' : <>{num(s.hitting.meanAmongHits)} <small className="kpi-unit">steps</small></>}</div>
            <div className="kpi-detail">E[T_A | T_A ≤ H] — not the unconditional mean first-passage time</div>
          </div>
        </div>
      )}
      {s.hitting && s.hitting.censoredCount > 0 && (
        <p className="hint" style={{ margin: 0 }}>{s.hitting.censoredCount.toLocaleString()} of {s.completed.toLocaleString()} trajectories did not reach the target within {config.horizon} steps.</p>
      )}

      <div className="card">
        <div className="card-title">
          <div>
            <h3>Probability of being in a state at step t</h3>
            <div className="hint">Points: estimate from trajectories, with shaded pointwise 95% Wilson intervals (n = {s.completed.toLocaleString()}). Line: exact μₜ.</div>
          </div>
          <select className="select input-sm" value={stateIdx} onChange={(e) => setStateIdx(Number(e.target.value))} aria-label="State to plot">
            {ids.map((id, i) => <option key={id} value={i}>{name(i)}</option>)}
          </select>
        </div>
        <div style={{ height: 240 }} role="img" aria-label={`Estimated versus exact probability of ${name(stateIdx)} over ${config.horizon} steps. The table below lists exact values.`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={tokens['chart-grid']} vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 11, fill: tokens['text-muted'] }} tickLine={false} axisLine={{ stroke: tokens['chart-axis'] }} />
              <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={{ fontSize: 11, fill: tokens['text-muted'] }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: tokens['bg-elevated'], border: `1px solid ${tokens.border}`, borderRadius: 6, fontSize: 12, color: tokens.text }}
                labelFormatter={(v) => `Step ${v} · ${name(stateIdx)}`}
                formatter={(v: number | number[], key: string) => [Array.isArray(v) ? `${formatProbability(v[0])} – ${formatProbability(v[1])}` : formatProbability(v), key === 'band' ? '95% interval (sampled)' : key === 'est' ? 'Estimate (sampled)' : 'Exact']} />
              <Area dataKey="band" stroke="none" fill={color} fillOpacity={0.12} isAnimationActive={false} />
              <Line dataKey="exact" stroke={color} strokeWidth={2} dot={false} type="linear" isAnimationActive={false} />
              <Line dataKey="est" stroke="none" dot={{ r: 2.5, fill: tokens.text, strokeWidth: 0 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <label className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span className="field-label">Table at step t = <span className="num">{shownT}</span></span>
            <input type="range" min={0} max={config.horizon} value={shownT} onChange={(e) => setT(Number(e.target.value))} aria-label="Step for the table" />
          </label>
        </div>
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="table">
            <caption className="visually-hidden">Estimated and exact distribution at step {shownT}</caption>
            <thead><tr><th scope="col">State</th><th scope="col" className="numeric">Count</th><th scope="col" className="numeric">Estimate</th><th scope="col" className="numeric">95% Wilson interval</th><th scope="col" className="numeric">Exact μₜ</th></tr></thead>
            <tbody>
              {ids.map((id, i) => {
                const iv = s.endpoint[shownT][i];
                return (
                  <tr key={id}>
                    <td><span className="swatch" style={{ background: stateColorVar(colorIndex.get(id) ?? i), marginRight: 6 }} aria-hidden />{name(i)}</td>
                    <td className="numeric">{Math.round((iv?.estimate ?? 0) * s.completed)}</td>
                    <td className="numeric">{formatProbability(iv?.estimate ?? 0)}</td>
                    <td className="numeric">{ci(iv)}</td>
                    <td className="numeric">{formatProbability(s.exactEndpoint[shownT]?.[i] ?? NaN)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {s.hitting && (
        <div className="card">
          <div className="card-title"><div>
            <h3>First hit of A by step</h3>
            <div className="hint">Bars: fraction of trajectories whose first hit is at step t. Line: exact first-arrival probability. Censored trajectories are counted separately, never at step H.</div>
          </div></div>
          <div style={{ height: 200 }} role="img" aria-label="Histogram of first-hit times with exact first-arrival probabilities">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={s.hitting.histogram} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={tokens['chart-grid']} vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 11, fill: tokens['text-muted'] }} tickLine={false} axisLine={{ stroke: tokens['chart-axis'] }} />
                <YAxis tick={{ fontSize: 11, fill: tokens['text-muted'] }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: tokens['bg-elevated'], border: `1px solid ${tokens.border}`, borderRadius: 6, fontSize: 12, color: tokens.text }}
                  labelFormatter={(v) => `First hit at step ${v}`} formatter={(v: number, key: string) => [formatProbability(v), key === 'fraction' ? 'Sampled fraction' : 'Exact']} />
                <Bar dataKey="fraction" fill={tokens['chart-1']} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Line dataKey="exact" stroke={tokens['chart-2']} strokeWidth={2} dot={false} type="linear" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <span className="badge badge-outline">Censored: {s.hitting.censoredCount.toLocaleString()} ({pct(s.hitting.censoredCount / Math.max(1, s.completed))})</span>
            <span className="badge badge-outline">Exact censored mass: {pctBound(1 - s.hitting.exactHitByHorizon)}</span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title"><div>
          <h3>Fraction of time spent in each state</h3>
          <div className="hint">Each trajectory contributes one visit fraction over t = {s.occupancyWindow.from}…{s.occupancyWindow.to} ({s.occupancyWindow.observations} observations); intervals use those {s.completed.toLocaleString()} independent values (Student t).</div>
        </div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">State</th><th scope="col" className="numeric">Mean fraction</th><th scope="col" className="numeric">s/√M</th><th scope="col" className="numeric">95% interval</th><th scope="col" className="numeric">Exact expected</th></tr></thead>
            <tbody>
              {s.occupancy.map((o) => (
                <tr key={o.state}>
                  <td>{name(o.state)}</td>
                  <td className="numeric">{formatProbability(o.summary.mean)}</td>
                  <td className="numeric">{fmtSe(o.summary.se)}</td>
                  <td className="numeric">{ci(o.summary.interval, (v) => formatProbability(Math.max(0, v)))}</td>
                  <td className="numeric">{formatProbability(o.exact)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 6 }}><Info size={12} aria-hidden /> Intervals are pointwise and assume approximate normality of the mean. Zero observed visits does not mean zero probability.</p>
      </div>
    </div>
  );
}
