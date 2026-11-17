import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowRight, Copy, Download, FlaskConical, GitCompare, Info, Network, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react';
import {
  alignByStableId, alignExplicit, compareScenarios, judge, mapTargets, runSweep, sweepGrid, COMPARISON_VERSION,
  type Change, type ComparisonResult, type MetricRow, type MetricUnit, type ModelChange, type Objective, type Rebalance, type StateAlignment,
} from '../../domain/comparison';
import { compileChain, formatProbability, rowOf, type ChainDocumentV1, type Command, type CompiledChain, type ScalarResult, type StateId } from '../../domain/markov';
import { EXPERIMENT_ENGINE, MAX_REPLICATIONS, mix32, parseSeed, RNG_ALGORITHM, type ExperimentConfig } from '../../domain/simulation';
import { newcombeDifference, welchDifference, type Interval } from '../../domain/statistics/intervals';
import { readTokens, type ResolvedTheme } from '../../app/theme';
import { Dialog } from '../../components/ui';
import { useExperiment } from '../experiments/useExperiment';
import type { Baseline } from './baseline';

interface Props {
  doc: ChainDocumentV1;
  chain: CompiledChain | null;
  baseline: Baseline;
  theme: ResolvedTheme;
  dispatch: (c: Command) => void;
  onEditInModeler: () => void;
  onLoadIntoModeler: (doc: ChainDocumentV1) => void;
}

// ───────────── formatting (never NaN/Infinity text) ─────────────

const isProb = (u: MetricUnit) => u === 'probability' || u === 'fraction';

function Value({ v, unit, stepLabel }: { v: ScalarResult; unit: MetricUnit; stepLabel?: string }) {
  if (v.kind === 'infinite') return <strong>Infinite</strong>;
  if (v.kind === 'undefined') return <span className="subtle" title={v.reason}>Not defined</span>;
  if (isProb(unit)) return <>{formatProbability(v.value, 4)}</>;
  return <>{v.value >= 1e6 ? v.value.toExponential(3) : v.value.toFixed(3)} <span className="subtle">{unit === 'steps' ? (stepLabel ? `${stepLabel}s` : 'steps') : 'reward'}</span></>;
}

function changeText(c: Change, unit: MetricUnit): { text: string; title?: string } {
  const d = c.difference;
  if (d.kind === 'undefined') return { text: 'Not defined', title: d.reason };
  if (d.kind === 'infinite') return { text: '+∞ (becomes infinite)' };
  if (d.value === 0) return { text: 'No change' };
  const sign = d.value > 0 ? '+' : '−';
  return isProb(unit) ? { text: `${sign}${Math.abs(d.value * 100).toFixed(2)} pp` } : { text: `${sign}${Math.abs(d.value).toFixed(3)}` };
}

function relText(c: Change): { text: string; title?: string } {
  if (c.relative.kind !== 'finite') return { text: 'not defined', title: c.relative.kind === 'undefined' ? c.relative.reason : undefined };
  if (c.relative.value === 0) return { text: '0%' };
  return { text: `${c.relative.value > 0 ? '+' : '−'}${Math.abs(c.relative.value).toFixed(1)}%` };
}

const fmtInterval = (i: Interval | null, pp: boolean) => {
  if (!i) return '—';
  const f = (x: number) => (pp ? `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(2)} pp` : `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(3)}`);
  return `${f(i.estimate)} [${f(i.lower)}, ${f(i.upper)}]`;
};

const STEPS = ['Baseline', 'Duplicate', 'Modify', 'Run', 'Compare', 'Explain'] as const;

export default function ComparePage({ doc, chain, baseline, theme, dispatch, onEditInModeler, onLoadIntoModeler }: Props) {
  const base = baseline.baseline?.document ?? null;
  const [confirm, setConfirm] = useState<null | 'replace' | 'discard' | 'reset'>(null);
  const [horizon, setHorizon] = useState(20);
  const [targets, setTargets] = useState<StateId[]>([]);
  const [explicitMap, setExplicitMap] = useState<Record<StateId, StateId>>({});
  const [objectives, setObjectives] = useState<Record<string, Objective>>({});
  const [rewardsOn, setRewardsOn] = useState(false);
  const [rewards, setRewards] = useState<Record<StateId, string>>({});

  const auto = useMemo(() => (base ? alignByStableId(base, doc) : null), [base, doc]);
  const alignment: StateAlignment | { error: string } | null = useMemo(() => {
    if (!base || !auto) return null;
    return auto.source === 'stable-id' ? auto : alignExplicit(base, doc, explicitMap);
  }, [base, auto, doc, explicitMap]);
  const al = alignment && !('error' in alignment) ? alignment : null;

  const validTargets = base ? targets.filter((t) => base.stateOrder.includes(t)) : [];
  const rewardMap = useMemo(() => {
    if (!rewardsOn || !base || !al) return undefined;
    const out: Record<StateId, number> = {};
    const val = (id: StateId) => { const t = rewards[id]; return t === undefined || t.trim() === '' ? NaN : Number(t); };
    base.stateOrder.forEach((id) => { out[id] = val(id); });
    al.pairs.forEach((p) => { out[p.alt] = out[p.base]; });
    al.altOnly.forEach((id) => { out[id] = val(id); });
    return out;
  }, [rewardsOn, rewards, base, al]);

  const spec = useMemo(() => ({ horizon, targetIds: validTargets, rewards: rewardMap }), [horizon, validTargets.join(), rewardMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const compared = useMemo(() => (base && al && al.pairs.length ? compareScenarios(base, doc, al, spec) : null), [base, al, doc, spec]);
  const result = compared?.ok ? compared.result : null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tokens = useMemo(() => readTokens(['chart-1', 'chart-muted', 'chart-grid', 'chart-axis', 'text-muted', 'bg-elevated', 'border', 'text'] as const), [theme]);
  const label = (d: ChainDocumentV1, id: StateId) => d.states.find((s) => s.id === id)?.label || 'Unnamed';
  const stepLabel = doc.metadata.stepLabel ?? base?.metadata.stepLabel;

  const done = {
    Baseline: !!base,
    Duplicate: !!base && auto?.source === 'stable-id',
    Modify: !!result && result.changes.length > 0,
    Run: !!result,
    Compare: !!result,
    Explain: !!result && result.changes.length > 0,
  };

  const exportBundle = () => {
    if (!base || !result) return;
    const bundle = {
      kind: 'markov-comparison', version: COMPARISON_VERSION, createdAt: new Date().toISOString(),
      design: 'exact (deterministic analysis of both scenarios under one specification)',
      baseline: { savedAt: baseline.baseline!.savedAt, modelHash: result.baseHash, document: base },
      alternative: { modelHash: result.altHash, document: doc },
      alignment: result.alignment, spec: result.spec, objectives,
      changes: result.changes, metrics: result.metrics, perState: result.perState,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${(doc.title || 'comparison').replace(/[^\w-]+/g, '-').toLowerCase()}.comparison.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="page page-wide">
      <header className="page-header">
        <div>
          <div className="eyebrow">Compare</div>
          <h1>Baseline versus alternative</h1>
          <p className="muted" style={{ maxWidth: '72ch' }}>
            Freeze a baseline, change a copy in the modeler, and compare exact results under one shared definition of every metric. Nothing is called “better” unless you state a goal.
          </p>
        </div>
        {result && <button className="btn btn-sm" onClick={exportBundle}><Download size={14} /> Export comparison</button>}
      </header>

      <ol className="workflow" aria-label="Comparison workflow">
        {STEPS.map((s, i) => (
          <li key={s} className={done[s] ? 'done' : ''}><span className="workflow-n" aria-hidden>{i + 1}</span>{s}<span className="visually-hidden">{done[s] ? ' (done)' : ''}</span></li>
        ))}
      </ol>

      {!base ? (
        <section className="card empty-state" style={{ padding: 32 }}>
          <GitCompare size={28} aria-hidden />
          <h3>No baseline yet</h3>
          <p style={{ maxWidth: '56ch', margin: '0 auto 12px' }}>
            The baseline is a frozen copy of the current model (“{doc.title}”). After saving it, keep editing in the modeler: what you edit becomes the alternative, with the same state identities so every probability can be matched.
          </p>
          <button className="btn btn-primary" disabled={!chain} onClick={() => baseline.setBaseline(doc)}><Copy size={16} /> Use current model as baseline</button>
          {!chain && <p className="hint" style={{ marginTop: 8 }}>Fix the model's validation issues first — a baseline must be a valid chain.</p>}
        </section>
      ) : (
        <div className="analysis-grid">
          <section className="card compare-scenarios" aria-label="Scenarios">
            <div>
              <div className="eyebrow">Baseline · frozen</div>
              <h3 style={{ margin: '2px 0' }}>{base.title}</h3>
              <p className="hint" style={{ margin: 0 }}>{base.stateOrder.length} states · saved {new Date(baseline.baseline!.savedAt).toLocaleString()}</p>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn btn-sm" onClick={() => setConfirm('reset')}><RotateCcw size={14} /> Reset alternative to baseline</button>
                <button className="btn btn-sm" disabled={!chain} onClick={() => setConfirm('replace')}>Replace baseline</button>
                <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirm('discard')}><Trash2 size={14} /> Discard</button>
              </div>
            </div>
            <ArrowRight className="compare-arrow" aria-hidden />
            <div>
              <div className="eyebrow">Alternative · live in the modeler</div>
              <h3 style={{ margin: '2px 0' }}>{doc.title}</h3>
              <p className="hint" style={{ margin: 0 }}>{doc.stateOrder.length} states{!chain ? ' · has validation errors' : ''}</p>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn btn-sm btn-primary" onClick={onEditInModeler}><Network size={14} /> Edit alternative</button>
              </div>
            </div>
            {baseline.storageFailed && <p className="hint" style={{ gridColumn: '1 / -1' }}>The baseline could not be saved to this browser's storage; it lasts until you reload.</p>}
          </section>

          {auto?.source === 'none' && (
            <section className="card" aria-labelledby="map-h">
              <h2 id="map-h" className="card-heading">Match states</h2>
              <p className="muted prose" style={{ fontSize: 13 }}>
                The alternative is not a duplicate of the baseline (no shared state identities). Equal names are not assumed to mean the same state: choose a counterpart for each baseline state. Unmatched states are left out of per-state comparisons.
              </p>
              <div className="field-row">
                {base.stateOrder.map((b) => (
                  <label key={b} className="field"><span className="field-label">{label(base, b)}</span>
                    <select className="select input-sm" value={explicitMap[b] ?? ''} onChange={(e) => setExplicitMap((m) => ({ ...m, [b]: e.target.value }))}>
                      <option value="">No counterpart</option>
                      {doc.stateOrder.map((a) => <option key={a} value={a}>{label(doc, a)}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              {alignment && 'error' in alignment && <div className="callout callout-error" style={{ marginTop: 8 }}><AlertTriangle /><p>{alignment.error}</p></div>}
            </section>
          )}

          {!chain ? (
            <div className="callout callout-warning"><AlertTriangle /><p>The alternative has validation errors. Fix them in the modeler to compare results; the baseline is unaffected.</p></div>
          ) : compared && !compared.ok ? (
            <div className="callout callout-error"><AlertTriangle /><p>The {compared.side} could not be analyzed: {compared.issues.join(' ')}</p></div>
          ) : !al?.pairs.length ? null : (
            <>
              <ChangesCard changes={result!.changes} base={base} alt={doc} onEdit={onEditInModeler} />

              <section className="card" aria-labelledby="spec-h">
                <h2 id="spec-h" className="card-heading">Shared definitions</h2>
                <p className="muted prose" style={{ fontSize: 13 }}>Both scenarios are evaluated with the same horizon, target set, and reward definition. Each scenario uses its own starting distribution μ₀ — a change there is listed above.</p>
                <div className="row" style={{ gap: 16, alignItems: 'flex-end' }}>
                  <label className="field" style={{ margin: 0 }}><span className="field-label">Horizon H ({stepLabel ? `${stepLabel}s` : 'steps'})</span>
                    <input className="input input-sm num" type="number" min={0} max={2000} value={horizon} style={{ width: 100 }} onChange={(e) => setHorizon(Math.max(0, Math.min(2000, Math.floor(Number(e.target.value) || 0))))} />
                  </label>
                  <div className="field" style={{ margin: 0 }}>
                    <span className="field-label">Target set A (for “reach” metrics)</span>
                    <div className="chip-list" role="group" aria-label="Target states">
                      {base.stateOrder.map((id) => (
                        <label key={id} className={`filter-chip${validTargets.includes(id) ? ' selected' : ''}`}>
                          <input type="checkbox" checked={validTargets.includes(id)} onChange={(e) => setTargets(e.target.checked ? [...validTargets, id] : validTargets.filter((t) => t !== id))} />
                          {label(base, id)}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <details style={{ marginTop: 12 }} open={rewardsOn}>
                  <summary className="hint" style={{ cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); setRewardsOn(!rewardsOn); }}>
                    {rewardsOn ? 'Remove' : 'Add'} an optional per-visit reward
                  </summary>
                  <p className="hint">Reward r(i) is earned at every observation time t = 0…H spent in state i (H + 1 observations, no discounting). Use it for costs or scores you can state per {stepLabel ?? 'step'}.</p>
                  <div className="field-row">
                    {[...base.stateOrder, ...(al?.altOnly ?? [])].map((id) => (
                      <label key={id} className="field"><span className="field-label">{base.stateOrder.includes(id) ? label(base, id) : `${label(doc, id)} (alternative only)`}</span>
                        <input className="input input-sm num" inputMode="decimal" value={rewards[id] ?? ''} placeholder="0" onChange={(e) => setRewards((r) => ({ ...r, [id]: e.target.value }))} />
                      </label>
                    ))}
                  </div>
                </details>
              </section>

              {result && <MetricsCard result={result} objectives={objectives} setObjectives={setObjectives} stepLabel={stepLabel} />}
              {result && <PerStateCard result={result} horizon={horizon} />}
              {result?.arrival.base && result.arrival.alt && (
                <section className="card" aria-labelledby="arrival-h">
                  <h2 id="arrival-h" className="card-heading">Pr(T_A ≤ t): reaching the target by step t</h2>
                  <div style={{ height: 220 }} role="img" aria-label={`Baseline reaches the target by step ${horizon} with probability ${formatProbability(result.arrival.base[horizon], 4)}; alternative ${formatProbability(result.arrival.alt[horizon], 4)}.`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.arrival.base.map((v, t) => ({ t, base: v, alt: result.arrival.alt![t] }))} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                        <CartesianGrid stroke={tokens['chart-grid']} vertical={false} />
                        <XAxis dataKey="t" tick={{ fontSize: 11, fill: tokens['text-muted'] }} tickLine={false} axisLine={{ stroke: tokens['chart-axis'] }} />
                        <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={{ fontSize: 11, fill: tokens['text-muted'] }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ background: tokens['bg-elevated'], border: `1px solid ${tokens.border}`, borderRadius: 6, fontSize: 12, color: tokens.text }}
                          labelFormatter={(t) => `By step ${t} · exact`} formatter={(v: number, n) => [formatProbability(v, 4), n]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line name="Baseline" dataKey="base" type="stepAfter" stroke={tokens['chart-muted']} strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line name="Alternative" dataKey="alt" type="stepAfter" stroke={tokens['chart-1']} strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="hint">Both curves use the same target set and horizon. Colors identify the scenario only; they do not mean better or worse.</p>
                </section>
              )}
              {result && <SweepCard base={base} alt={doc} alignment={al} spec={spec} result={result} dispatch={dispatch} tokens={tokens} />}
              {result && chain && <MonteCarloCard base={base} alt={doc} alignment={al} horizon={horizon} targets={validTargets} />}
              {result && <ExplainCard result={result} objectives={objectives} base={base} alt={doc} />}
            </>
          )}
        </div>
      )}

      {confirm && (
        <Dialog size="sm" title={confirm === 'replace' ? 'Replace the baseline?' : confirm === 'discard' ? 'Discard the baseline?' : 'Reset the alternative?'} onClose={() => setConfirm(null)}
          footer={<>
            <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
            <button className={`btn ${confirm === 'discard' ? 'btn-danger' : 'btn-primary'}`} onClick={() => {
              if (confirm === 'replace') baseline.setBaseline(doc);
              else if (confirm === 'discard') baseline.clear();
              else if (base) onLoadIntoModeler(base);
              setConfirm(null);
            }}>{confirm === 'replace' ? 'Replace baseline' : confirm === 'discard' ? 'Discard baseline' : 'Reset alternative'}</button>
          </>}>
          <p>{confirm === 'replace' ? 'The current alternative becomes the new baseline. The old baseline is not kept; export the comparison first if you need it.'
            : confirm === 'discard' ? 'The frozen baseline is removed. The model in the modeler is not changed.'
            : 'The modeler model is replaced by a copy of the baseline. You can undo this in the modeler.'}</p>
        </Dialog>
      )}
    </div>
  );
}

// ───────────── cards ─────────────

function ChangesCard({ changes, base, alt, onEdit }: { changes: ModelChange[]; base: ChainDocumentV1; alt: ChainDocumentV1; onEdit: () => void }) {
  const lb = (id: StateId) => base.states.find((s) => s.id === id)?.label || '—';
  const la = (id: StateId) => alt.states.find((s) => s.id === id)?.label || '—';
  const trans = changes.filter((c): c is Extract<ModelChange, { kind: 'transition' }> => c.kind === 'transition');
  const init = changes.filter((c): c is Extract<ModelChange, { kind: 'initial' }> => c.kind === 'initial');
  const other = changes.filter((c) => c.kind !== 'transition' && c.kind !== 'initial');
  const pp = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(2)} pp`;
  return (
    <section className="card" aria-labelledby="changes-h">
      <h2 id="changes-h" className="card-heading">What changed</h2>
      {changes.length === 0 ? (
        <div className="empty-state" style={{ padding: 16 }}>
          <p>The alternative is identical to the baseline. Edit it in the modeler — every changed probability will be listed here.</p>
          <button className="btn btn-sm" onClick={onEdit}><Network size={14} /> Edit alternative</button>
        </div>
      ) : (
        <>
          {trans.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <caption className="visually-hidden">Changed transition probabilities</caption>
                <thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col" className="numeric">Baseline</th><th scope="col" className="numeric">Alternative</th><th scope="col" className="numeric">Change</th></tr></thead>
                <tbody>
                  {trans.map((c) => (
                    <tr key={`${c.altFrom}>${c.to || c.altTo}`}>
                      <td>{lb(c.from)}</td>
                      <td>{c.to ? lb(c.to) : `${la(c.altTo)} (new)`}{!c.altTo && ' (removed)'}</td>
                      <td className="numeric">{formatProbability(c.base)}</td>
                      <td className="numeric">{formatProbability(c.alt)}</td>
                      <td className="numeric">{pp(c.alt - c.base)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {init.length > 0 && <p className="hint" style={{ marginTop: 8 }}><strong>Starting distribution:</strong> {init.map((c) => `${lb(c.state)} ${formatProbability(c.base)} → ${formatProbability(c.alt)}`).join('; ')}.</p>}
          {other.length > 0 && (
            <ul className="hint" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {other.map((c, i) => (
                <li key={i}>{c.kind === 'state-added' ? `State added: ${c.label}` : c.kind === 'state-removed' ? `State removed: ${c.label}` : c.kind === 'renamed' ? `Renamed: ${c.from} → ${c.to} (display only)` : c.kind === 'step-label' ? `Step meaning: “${c.base ?? 'not set'}” → “${c.alt ?? 'not set'}”` : ''}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function MetricsCard({ result, objectives, setObjectives, stepLabel }: { result: ComparisonResult; objectives: Record<string, Objective>; setObjectives: (f: (o: Record<string, Objective>) => Record<string, Objective>) => void; stepLabel?: string }) {
  if (!result.metrics.length) {
    return (
      <section className="card"><h2 className="card-heading">Results</h2>
        <p className="muted">Choose a target set above to compare reaching times, or open a model with absorbing states to compare eventual outcomes. Per-state results are below.</p>
      </section>
    );
  }
  return (
    <section className="card" aria-labelledby="metrics-h">
      <h2 id="metrics-h" className="card-heading">Results (exact)</h2>
      <div className="table-wrap">
        <table className="table">
          <caption className="visually-hidden">Baseline and alternative values for each metric</caption>
          <thead><tr><th scope="col">Metric</th><th scope="col" className="numeric">Baseline</th><th scope="col" className="numeric">Alternative</th><th scope="col" className="numeric">Change</th><th scope="col" className="numeric">Relative</th><th scope="col">Your goal</th></tr></thead>
          <tbody>
            {result.metrics.map((m) => <MetricLine key={m.id} m={m} objective={objectives[m.id] ?? null} stepLabel={stepLabel} onObjective={(o) => setObjectives((x) => ({ ...x, [m.id]: o }))} />)}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 6 }}>Probability changes are in percentage points (pp). Relative change = (alternative − baseline) / |baseline| × 100 and is not defined when the baseline is 0, infinite, or not defined. Hover “Not defined” for the reason.</p>
    </section>
  );
}

function MetricLine({ m, objective, onObjective, stepLabel }: { m: MetricRow; objective: Objective; onObjective: (o: Objective) => void; stepLabel?: string }) {
  const ch = changeText(m.change, m.unit);
  const rel = relText(m.change);
  const verdict = judge(m.change, objective);
  return (
    <tr>
      <td><div>{m.label}</div><div className="hint">{m.definition}{m.note ? ` ${m.note}` : ''}</div></td>
      <td className="numeric"><Value v={m.base} unit={m.unit} stepLabel={stepLabel} /></td>
      <td className="numeric"><Value v={m.alt} unit={m.unit} stepLabel={stepLabel} /></td>
      <td className="numeric" title={ch.title}>{ch.text}</td>
      <td className="numeric" title={rel.title}>{rel.text}</td>
      <td>
        <label className="visually-hidden" htmlFor={`goal-${m.id}`}>Goal for {m.label}</label>
        <select id={`goal-${m.id}`} className="select input-sm" value={objective ?? ''} onChange={(e) => onObjective((e.target.value || null) as Objective)}>
          <option value="">No goal</option>
          <option value="increase">Higher is better</option>
          <option value="decrease">Lower is better</option>
        </select>
        {verdict && <div style={{ marginTop: 4 }}><span className={`badge ${verdict === 'improves' ? 'badge-success' : verdict === 'worsens' ? 'badge-error' : 'badge-outline'}`}>{verdict === 'improves' ? 'Meets goal direction' : verdict === 'worsens' ? 'Against goal' : 'No change'}</span></div>}
      </td>
    </tr>
  );
}

function PerStateCard({ result, horizon }: { result: ComparisonResult; horizon: number }) {
  const pp = (c: Change) => changeText(c, 'probability');
  return (
    <section className="card" aria-labelledby="perstate-h">
      <h2 id="perstate-h" className="card-heading">Per state</h2>
      <p className="muted prose" style={{ fontSize: 13 }}>μ_H is the probability of being in the state at step {horizon}. Occupancy is the expected fraction of the {horizon + 1} observations t = 0…{horizon} spent in the state. These are different questions from “ever reached”.</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th scope="col">State</th><th scope="col" className="numeric">μ_H baseline</th><th scope="col" className="numeric">μ_H alternative</th><th scope="col" className="numeric">Change</th><th scope="col" className="numeric">Occupancy baseline</th><th scope="col" className="numeric">Occupancy alternative</th><th scope="col" className="numeric">Change</th></tr></thead>
          <tbody>
            {result.perState.map((r) => (
              <tr key={r.base}>
                <td>{r.label}</td>
                <td className="numeric">{formatProbability(r.distribution.base, 4)}</td>
                <td className="numeric">{formatProbability(r.distribution.alt, 4)}</td>
                <td className="numeric">{pp(r.distribution.change).text}</td>
                <td className="numeric">{formatProbability(r.occupancy.base, 4)}</td>
                <td className="numeric">{formatProbability(r.occupancy.alt, 4)}</td>
                <td className="numeric">{pp(r.occupancy.change).text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(result.alignment.baseOnly.length > 0 || result.alignment.altOnly.length > 0) && <p className="hint" style={{ marginTop: 6 }}>States without a counterpart are not compared per state.</p>}
    </section>
  );
}

function SweepCard({ base, alt, alignment, spec, result, dispatch, tokens }: {
  base: ChainDocumentV1; alt: ChainDocumentV1; alignment: StateAlignment; spec: Parameters<typeof compareScenarios>[3]; result: ComparisonResult;
  dispatch: (c: Command) => void; tokens: Record<string, string>;
}) {
  const metricOptions = [...result.metrics.map((m) => ({ id: m.id, label: m.label, unit: m.unit })),
    ...result.perState.map((p) => ({ id: `mu:${p.alt}`, label: `μ_H(${p.label})`, unit: 'probability' as MetricUnit }))];
  // Default to the first row with a real choice (two or more positive entries), and one of its non-self destinations.
  const initial = (() => {
    for (const id of alt.stateOrder) {
      const row = rowOf(alt, id);
      if (row.filter((p) => p > 0).length >= 2) {
        const j = row.findIndex((p, k) => p > 0 && alt.stateOrder[k] !== id);
        return { from: id, to: alt.stateOrder[j >= 0 ? j : 0] };
      }
    }
    return { from: alt.stateOrder[0] ?? '', to: alt.stateOrder[0] ?? '' };
  })();
  const [from, setFrom] = useState<StateId>(initial.from);
  const [to, setTo] = useState<StateId>(initial.to);
  const [ruleKind, setRuleKind] = useState<'proportional' | 'compensate'>('proportional');
  const [comp, setComp] = useState<StateId>('');
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(1);
  const [points, setPoints] = useState(11);
  const [metricId, setMetricId] = useState(metricOptions[0]?.id ?? '');
  const metric = metricOptions.find((m) => m.id === metricId) ?? metricOptions[0];
  const la = (id: StateId) => alt.states.find((s) => s.id === id)?.label || 'Unnamed';
  const rule: Rebalance = ruleKind === 'proportional' ? { kind: 'proportional' } : { kind: 'compensate', with: comp };

  const sweep = useMemo(() => {
    if (!metric || !alt.stateOrder.includes(from) || !alt.stateOrder.includes(to) || (ruleKind === 'compensate' && !comp)) return null;
    const lo = Math.max(0, Math.min(min, max));
    const hi = Math.min(1, Math.max(min, max));
    return runSweep(alt, from, to, sweepGrid(lo, hi, points), rule, (d) => {
      const r = compareScenarios(base, d, alignment, spec);
      if (!r.ok) return null;
      if (metric.id.startsWith('mu:')) {
        const row = r.result.perState.find((p) => `mu:${p.alt}` === metric.id);
        return row ? ({ kind: 'finite', value: row.distribution.alt } as ScalarResult) : null;
      }
      return r.result.metrics.find((m) => m.id === metric.id)?.alt ?? null;
    });
  }, [alt, base, alignment, spec, from, to, ruleKind, comp, min, max, points, metric?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const baseValue: ScalarResult | null = metric?.id.startsWith('mu:')
    ? (() => { const r = result.perState.find((p) => `mu:${p.alt}` === metric.id); return r ? { kind: 'finite', value: r.distribution.base } as ScalarResult : null; })()
    : result.metrics.find((m) => m.id === metric?.id)?.base ?? null;
  const current = (() => { const c = compileChain(alt); if (c.status !== 'ok') return null; const i = alt.stateOrder.indexOf(from); const j = alt.stateOrder.indexOf(to); return i >= 0 && j >= 0 ? c.result.P[i][j] : null; })();
  const data = sweep?.map((p) => ({ x: p.value, y: p.outcome.ok && p.outcome.metric?.kind === 'finite' ? p.outcome.metric.value : null }));

  return (
    <section className="card" aria-labelledby="sweep-h">
      <h2 id="sweep-h" className="card-heading"><SlidersHorizontal size={18} aria-hidden /> Parameter sweep</h2>
      <p className="muted prose" style={{ fontSize: 13 }}>
        Vary one transition probability of the alternative and see one metric respond. The row must still total 1, so the difference is taken from the other entries of the same row by the rule you choose. Values the rule cannot reach are listed, not hidden.
      </p>
      <div className="field-row">
        <label className="field"><span className="field-label">From</span>
          <select className="select input-sm" value={from} onChange={(e) => setFrom(e.target.value)}>{alt.stateOrder.map((id) => <option key={id} value={id}>{la(id)}</option>)}</select></label>
        <label className="field"><span className="field-label">To</span>
          <select className="select input-sm" value={to} onChange={(e) => setTo(e.target.value)}>{alt.stateOrder.map((id) => <option key={id} value={id}>{la(id)}{id === from ? ' (self-loop)' : ''}</option>)}</select></label>
        <label className="field"><span className="field-label">Keep the row valid by</span>
          <select className="select input-sm" value={ruleKind} onChange={(e) => setRuleKind(e.target.value as 'proportional' | 'compensate')}>
            <option value="proportional">Scaling the other entries proportionally</option>
            <option value="compensate">Adjusting one other destination</option>
          </select></label>
        {ruleKind === 'compensate' && (
          <label className="field"><span className="field-label">Adjust</span>
            <select className="select input-sm" value={comp} onChange={(e) => setComp(e.target.value)}>
              <option value="">Choose…</option>
              {alt.stateOrder.filter((id) => id !== to).map((id) => <option key={id} value={id}>{la(id)}</option>)}
            </select></label>
        )}
      </div>
      <div className="field-row">
        <label className="field"><span className="field-label">From value</span><input className="input input-sm num" type="number" step={0.05} min={0} max={1} value={min} onChange={(e) => setMin(Number(e.target.value))} /></label>
        <label className="field"><span className="field-label">To value</span><input className="input input-sm num" type="number" step={0.05} min={0} max={1} value={max} onChange={(e) => setMax(Number(e.target.value))} /></label>
        <label className="field"><span className="field-label">Points</span><input className="input input-sm num" type="number" min={2} max={51} value={points} onChange={(e) => setPoints(Math.max(2, Math.min(51, Math.floor(Number(e.target.value) || 2))))} /></label>
        <label className="field"><span className="field-label">Metric</span>
          <select className="select input-sm" value={metric?.id ?? ''} onChange={(e) => setMetricId(e.target.value)}>{metricOptions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
      </div>
      {current !== null && <p className="hint">Current alternative value: P({la(from)} → {la(to)}) = {formatProbability(current)}.</p>}

      {sweep && data && metric && (
        <>
          <div style={{ height: 200 }} role="img" aria-label={`${metric.label} as P(${la(from)} → ${la(to)}) varies from ${min} to ${max}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -4 }}>
                <CartesianGrid stroke={tokens['chart-grid']} vertical={false} />
                <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 11, fill: tokens['text-muted'] }} tickLine={false} axisLine={{ stroke: tokens['chart-axis'] }} />
                <YAxis tick={{ fontSize: 11, fill: tokens['text-muted'] }} tickLine={false} axisLine={false} width={48} />
                <Tooltip contentStyle={{ background: tokens['bg-elevated'], border: `1px solid ${tokens.border}`, borderRadius: 6, fontSize: 12, color: tokens.text }}
                  labelFormatter={(x) => `P(${la(from)} → ${la(to)}) = ${x}`} formatter={(v: number) => [isProb(metric.unit) ? formatProbability(v, 4) : v.toFixed(3), metric.label]} />
                {baseValue?.kind === 'finite' && <ReferenceLine y={baseValue.value} stroke={tokens['chart-muted']} strokeDasharray="5 4" label={{ value: 'Baseline', fontSize: 11, fill: tokens['text-muted'], position: 'insideTopRight' }} />}
                {current !== null && <ReferenceLine x={current} stroke={tokens['chart-axis']} strokeDasharray="2 3" />}
                <Line dataKey="y" stroke={tokens['chart-1']} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details>
            <summary className="hint" style={{ cursor: 'pointer' }}>Sweep table ({sweep.filter((p) => !p.outcome.ok).length} unreachable values)</summary>
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table className="table">
                <thead><tr><th scope="col" className="numeric">P({la(from)} → {la(to)})</th><th scope="col" className="numeric">{metric.label}</th><th scope="col">Row used</th><th scope="col"><span className="visually-hidden">Apply</span></th></tr></thead>
                <tbody>
                  {sweep.map((p) => {
                    const row = p.outcome.ok ? rowOf(p.outcome.doc, from) : null;
                    return (
                      <tr key={p.value}>
                        <td className="numeric">{p.value}</td>
                        <td className="numeric">{p.outcome.ok ? (p.outcome.metric ? <Value v={p.outcome.metric} unit={metric.unit} /> : '—') : <span className="subtle">{p.outcome.reason}</span>}</td>
                        <td className="hint">{row?.flatMap((v, k) => (v ? [`${la(alt.stateOrder[k])} ${formatProbability(v, 3)}`] : [])).join(', ')}</td>
                        <td>{row && <button className="btn btn-sm btn-ghost" onClick={() => dispatch({ type: 'setRow', stateId: from, row })}>Apply</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="hint">“Apply” changes the alternative's row (undoable in the modeler). The baseline never changes.</p>
          </details>
        </>
      )}
    </section>
  );
}

function MonteCarloCard({ base, alt, alignment, horizon, targets }: { base: ChainDocumentV1; alt: ChainDocumentV1; alignment: StateAlignment; horizon: number; targets: StateId[] }) {
  const b = useExperiment();
  const a = useExperiment();
  const [reps, setReps] = useState(2000);
  const [seedText, setSeedText] = useState('12345');
  const seed = parseSeed(seedText);
  const altSeed = seed === null ? null : mix32(seed ^ 0x5bd1e995);
  const altTargets = mapTargets(alignment, targets);
  const running = [b.status, a.status].some((s) => s === 'running' || s === 'cancelling');
  const bc = useMemo(() => compileChain(base), [base]);
  const ac = useMemo(() => compileChain(alt), [alt]);
  const lab = (d: ChainDocumentV1) => Object.fromEntries(d.states.map((s) => [s.id, s.label]));
  const H = Math.min(horizon, 2000);

  const run = () => {
    if (seed === null || altSeed === null || bc.status !== 'ok' || ac.status !== 'ok') return;
    const cfg = (c: CompiledChain, s: number, t: StateId[]): ExperimentConfig => ({ schemaVersion: 1, modelHash: c.modelHash, seed: s, replications: reps, horizon: H, burnIn: 0, targetIds: t, traceLimit: 0 });
    b.run(bc.result, cfg(bc.result, seed, targets), lab(base));
    a.run(ac.result, cfg(ac.result, altSeed, altTargets.every(Boolean) ? (altTargets as StateId[]) : []), lab(alt));
  };

  const br = b.result; const ar = a.result;
  const fresh = br && ar && br.chain.modelHash === (bc.status === 'ok' ? bc.result.modelHash : '') && ar.chain.modelHash === (ac.status === 'ok' ? ac.result.modelHash : '') && br.config.horizon === H;
  const n = (r: NonNullable<typeof br>) => r.chain.stateIds.length;

  return (
    <section className="card" aria-labelledby="mc-h">
      <h2 id="mc-h" className="card-heading"><FlaskConical size={18} aria-hidden /> Check by simulation (optional)</h2>
      <p className="muted prose" style={{ fontSize: 13 }}>
        Runs independent Monte Carlo experiments for both scenarios with <strong>separate random streams</strong> (baseline seed and a derived alternative seed). The comparison is unpaired: intervals for differences treat the two samples as independent. Reusing one seed would not make it a paired design.
      </p>
      <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
        <label className="field" style={{ margin: 0 }}><span className="field-label">Replications per scenario</span>
          <input className="input input-sm num" type="number" min={10} max={MAX_REPLICATIONS} value={reps} style={{ width: 120 }} onChange={(e) => setReps(Math.max(10, Math.min(MAX_REPLICATIONS, Math.floor(Number(e.target.value) || 10))))} /></label>
        <label className="field" style={{ margin: 0 }}><span className="field-label">Baseline seed</span>
          <input className="input input-sm num" value={seedText} style={{ width: 130 }} aria-invalid={seed === null || undefined} onChange={(e) => setSeedText(e.target.value)} /></label>
        <span className="hint">Alternative seed: {altSeed ?? '—'}</span>
        {running ? <button className="btn btn-sm" onClick={() => { b.cancel(); a.cancel(); }}>Cancel</button>
          : <button className="btn btn-sm btn-primary" disabled={seed === null} onClick={run}>Run both</button>}
      </div>
      {running && <p className="hint" role="status">Running… baseline {b.progress.completed.toLocaleString()}/{b.progress.total.toLocaleString()}, alternative {a.progress.completed.toLocaleString()}/{a.progress.total.toLocaleString()}</p>}
      {(b.error || a.error) && <div className="callout callout-error"><AlertTriangle /><p>{b.error ?? a.error}</p></div>}
      {br && ar && !running && (
        <>
          {!fresh && <div className="callout callout-warning" style={{ marginTop: 8 }}><Info /><p>A scenario or the horizon changed after this run. These results describe the earlier models; run again to update.</p></div>}
          {(br.status === 'cancelled' || ar.status === 'cancelled') && <p className="hint">Partial results: {br.acc.completed.toLocaleString()} baseline and {ar.acc.completed.toLocaleString()} alternative replications completed.</p>}
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table">
              <caption className="visually-hidden">Simulated estimates with 95% intervals</caption>
              <thead><tr><th scope="col">Quantity</th><th scope="col" className="numeric">Baseline estimate</th><th scope="col" className="numeric">Alternative estimate</th><th scope="col" className="numeric">Difference [95% interval]</th></tr></thead>
              <tbody>
                {br.summary.hitting && ar.summary.hitting && (
                  <>
                    <tr><td>Reach target within {H} steps</td><td className="numeric">{formatProbability(br.summary.hitting.hitByHorizon?.estimate ?? NaN, 4)}</td><td className="numeric">{formatProbability(ar.summary.hitting.hitByHorizon?.estimate ?? NaN, 4)}</td>
                      <td className="numeric">{fmtInterval(newcombeDifference(br.summary.hitting.hitCount, br.acc.completed, ar.summary.hitting.hitCount, ar.acc.completed), true)}</td></tr>
                    <tr><td>Restricted mean E[min(T_A, {H})]</td><td className="numeric">{br.summary.hitting.restrictedMean.mean.toFixed(3)}</td><td className="numeric">{ar.summary.hitting.restrictedMean.mean.toFixed(3)}</td>
                      <td className="numeric">{fmtInterval(welchDifference(br.summary.hitting.restrictedMean, ar.summary.hitting.restrictedMean), false)}</td></tr>
                  </>
                )}
                {alignment.pairs.map((p) => {
                  const i = br.chain.stateIds.indexOf(p.base); const j = ar.chain.stateIds.indexOf(p.alt);
                  if (i < 0 || j < 0) return null;
                  const kb = br.acc.endpoint[H * n(br) + i]; const ka = ar.acc.endpoint[H * n(ar) + j];
                  return (
                    <tr key={p.base}><td>μ_{H}({base.states.find((s) => s.id === p.base)?.label})</td>
                      <td className="numeric">{formatProbability(kb / br.acc.completed, 4)}</td><td className="numeric">{formatProbability(ka / ar.acc.completed, 4)}</td>
                      <td className="numeric">{fmtInterval(newcombeDifference(kb, br.acc.completed, ka, ar.acc.completed), true)}</td></tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            Differences use the Newcombe hybrid score interval (proportions) and the Welch t interval (means), both pointwise 95%. Compare them with the exact changes above: the simulation estimates those values with sampling error. Engine {EXPERIMENT_ENGINE}, RNG {RNG_ALGORITHM}.
          </p>
        </>
      )}
    </section>
  );
}

function ExplainCard({ result, objectives, base, alt }: { result: ComparisonResult; objectives: Record<string, Objective>; base: ChainDocumentV1; alt: ChainDocumentV1 }) {
  const lb = (id: StateId) => base.states.find((s) => s.id === id)?.label || 'Unnamed';
  const la = (id: StateId) => alt.states.find((s) => s.id === id)?.label || 'Unnamed';
  const trans = result.changes.filter((c): c is Extract<ModelChange, { kind: 'transition' }> => c.kind === 'transition');
  const rows = [...new Set(trans.map((c) => lb(c.from)))];
  const sentences: string[] = [];
  if (!result.changes.length) sentences.push('The two scenarios are identical, so every difference is zero.');
  if (rows.length) sentences.push(`You changed ${trans.length} transition probabilit${trans.length === 1 ? 'y' : 'ies'} in the ${rows.join(', ')} row${rows.length > 1 ? 's' : ''}.`);
  const init = result.changes.filter((c) => c.kind === 'initial');
  if (init.length) sentences.push('The starting distribution also differs, so part of any change comes from where the chain starts.');
  const added = result.changes.filter((c) => c.kind === 'state-added').map((c) => (c.kind === 'state-added' ? la(c.state) : ''));
  if (added.length) sentences.push(`The alternative adds ${added.join(', ')}; these have no baseline counterpart.`);
  for (const m of result.metrics) {
    const d = m.change.difference;
    if (m.change.direction === 'same' || m.change.direction === null) continue;
    const verdict = judge(m.change, objectives[m.id] ?? null);
    const goal = verdict === 'improves' ? ', which is in the direction of your goal' : verdict === 'worsens' ? ', which is against your goal' : '';
    const fmt = (v: ScalarResult) => (v.kind === 'finite' ? (isProb(m.unit) ? formatProbability(v.value, 4) : v.value.toFixed(3)) : v.kind === 'infinite' ? 'infinite' : 'not defined');
    const amount = d.kind === 'finite' ? (isProb(m.unit) ? ` (${Math.abs(d.value * 100).toFixed(2)} percentage points)` : ` (by ${Math.abs(d.value).toFixed(3)})`) : '';
    sentences.push(`${m.label} ${m.change.direction === 'up' ? 'increased' : 'decreased'} from ${fmt(m.base)} to ${fmt(m.alt)}${amount}${goal}.`);
  }
  return (
    <section className="card" aria-labelledby="explain-h">
      <h2 id="explain-h" className="card-heading">Explain</h2>
      <ul className="prose" style={{ paddingLeft: 18, margin: 0 }}>{sentences.map((s) => <li key={s}>{s}</li>)}</ul>
      <p className="hint" style={{ marginTop: 8 }}>
        These are exact consequences of the two models as written. They show what the model implies, not that the change would have this effect in reality — that depends on whether the probabilities and the Markov assumption describe the real situation.
      </p>
    </section>
  );
}
