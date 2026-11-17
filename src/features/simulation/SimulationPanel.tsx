import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Dices, Download, Pause, Play, RotateCcw, SkipBack, SkipForward, Square } from 'lucide-react';
import { formatProbability, type ChainDocumentV1, type StateId } from '../../domain/markov';
import { buildCdfRow, parseSeed, trajectoryToCsv } from '../../domain/simulation';
import { stateColorVar } from '../../components/ui';
import { SPEEDS, type RunStatus, type Simulation } from './useSimulation';

const STATUS_LABEL: Record<RunStatus, string> = {
  ready: 'Ready', running: 'Running', paused: 'Paused', stopped: 'Stopped', completed: 'Completed',
};
const TRACE_WINDOW = 300;

function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SimulationPanel({ doc, sim, valid }: { doc: ChainDocumentV1; sim: Simulation; valid: boolean }) {
  const { config, run, playhead, status, current } = sim;
  const [seedText, setSeedText] = useState(String(config.seed));
  const [follow, setFollow] = useState(true);
  const traceRef = useRef<HTMLDivElement>(null);
  const colorIndex = new Map(doc.states.map((s, i) => [s.id, i]));
  useEffect(() => setSeedText(String(config.seed)), [config.seed]);

  const labelOf = (id: StateId) => run?.labels[id] ?? doc.states.find((s) => s.id === id)?.label ?? id;
  const ids = run?.trajectory.stateIds ?? [];
  const name = (i: number | null) => (i === null ? '—' : labelOf(ids[i]));
  const events = run ? run.trajectory.events.slice(0, playhead + 1) : [];
  const shownEvents = events.slice(-TRACE_WINDOW);
  const seedValid = parseSeed(seedText) !== null;
  const unit = doc.metadata.stepLabel ?? 'step';

  useEffect(() => {
    if (!follow || !traceRef.current) return;
    const row = traceRef.current.querySelector<HTMLElement>('tr.current');
    row?.scrollIntoView({ block: 'nearest' });
  }, [playhead, follow]);

  const runningLabel = status === 'running' ? `Running · step ${current?.step ?? 0}` : `${STATUS_LABEL[status]} · step ${current?.step ?? 0}`;
  const visits = new Map<number, number>();
  events.forEach((e) => visits.set(e.to, (visits.get(e.to) ?? 0) + 1));

  return (
    <div className="sim">
      <div className="sim-controls" role="group" aria-label="Playback controls">
        <div className="toolbar-group">
          {status === 'running' ? (
            <button className="btn btn-primary sim-play" onClick={sim.pause}><Pause size={16} /> Pause</button>
          ) : (
            <button className="btn btn-primary sim-play" onClick={sim.play} disabled={!valid}><Play size={16} /> Play</button>
          )}
          <button className="btn btn-icon" onClick={sim.stepBack} disabled={!run || playhead === 0} aria-label="Step back" title="Step back (replays recorded history)"><SkipBack size={16} /></button>
          <button className="btn" onClick={sim.step} disabled={!valid || status === 'completed' || status === 'stopped'} title="Advance exactly one transition"><SkipForward size={16} /> Step</button>
          <button className="btn btn-icon" onClick={sim.stop} disabled={status === 'ready' || status === 'stopped' || status === 'completed'} aria-label="Stop" title="Stop: end the run and keep its trace"><Square size={14} /></button>
          <button className="btn btn-icon" onClick={sim.reset} disabled={!valid} aria-label="Reset" title="Reset: same seed and settings, back to step 0"><RotateCcw size={16} /></button>
        </div>
        <span className={`badge ${status === 'running' ? 'badge-accent' : 'badge-outline'} num`}>{runningLabel}</span>
        <span className="visually-hidden" role="status" aria-live="polite">{STATUS_LABEL[status]}{status === 'completed' && run ? `, ${run.trajectory.events.length - 1} transitions` : ''}</span>
        <span className="toolbar-spacer" />
        <label className="row hint" style={{ gap: 6 }}>Speed
          <select className="select input-sm" value={config.speed} onChange={(e) => sim.setConfig({ speed: Number(e.target.value) as typeof config.speed })}>
            {SPEEDS.map((s) => <option key={s} value={s}>{s} step{s === 1 ? '' : 's'}/s</option>)}
          </select>
        </label>
      </div>

      <div className="sim-config">
        <label className="field"><span className="field-label">Seed</span>
          <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
            <input className="input input-sm num" value={seedText} inputMode="numeric" aria-invalid={!seedValid || undefined} style={{ width: 110 }}
              onChange={(e) => { setSeedText(e.target.value); const s = parseSeed(e.target.value); if (s !== null && s !== config.seed) sim.setConfig({ seed: s }); }} />
            <button className="btn btn-sm btn-icon" onClick={sim.newSeed} aria-label="New random seed" title="New random seed"><Dices size={14} /></button>
          </span>
          {!seedValid && <span className="hint" style={{ color: 'var(--error)' }}>Whole number 0–4294967295</span>}
        </label>
        <label className="field"><span className="field-label">Horizon (transitions)</span>
          <input className="input input-sm num" type="number" min={0} max={10000} value={config.horizon} style={{ width: 90 }}
            onChange={(e) => sim.setConfig({ horizon: Math.max(0, Math.min(10000, Math.floor(Number(e.target.value) || 0))) })} />
        </label>
        <label className="field"><span className="field-label">Start</span>
          <select className="select input-sm" value={config.start} onChange={(e) => sim.setConfig({ start: e.target.value })}>
            <option value="mu0">Sample from μ₀</option>
            {doc.stateOrder.map((id) => <option key={id} value={id}>{doc.states.find((s) => s.id === id)?.label}</option>)}
          </select>
        </label>
        <label className="row" style={{ gap: 6, fontSize: 13, alignSelf: 'center' }}>
          <input type="checkbox" checked={config.stopOnAbsorption} onChange={(e) => sim.setConfig({ stopOnAbsorption: e.target.checked })} />
          Stop on absorbing state
        </label>
        <button className="btn btn-sm btn-ghost" style={{ alignSelf: 'center' }} disabled={!run}
          onClick={() => run && downloadText(`trajectory-seed-${run.trajectory.config.seed}.csv`, trajectoryToCsv(run.trajectory, labelOf), 'text/csv')}>
          <Download size={14} /> Export trace
        </button>
      </div>

      {!valid && <div className="callout callout-warning" style={{ marginBottom: 8 }}><AlertTriangle /><p>Fix the issues in Validate before running. {run ? 'The previous run is still shown.' : ''}</p></div>}
      {sim.modelChanged && valid && (
        <div className="callout callout-warning" style={{ marginBottom: 8 }}><AlertTriangle />
          <div className="row" style={{ justifyContent: 'space-between', flex: 1 }}>
            <p style={{ margin: 0 }}>The model changed, so this run was paused. It still shows the earlier model version.</p>
            <button className="btn btn-sm" onClick={sim.reset}>Restart with current model</button>
          </div>
        </div>
      )}

      <div className="sim-body">
        <div>
          <div className="table-wrap sim-trace" ref={traceRef} tabIndex={0} aria-label="Trace"
            onWheel={() => setFollow(false)} onTouchMove={() => setFollow(false)}>
            <table className="table">
              <caption className="visually-hidden">Trace of the sample trajectory up to the current step</caption>
              <thead><tr><th scope="col" className="numeric">t</th><th scope="col">From</th><th scope="col">To</th><th scope="col" className="numeric">Probability</th><th scope="col" className="numeric">Draw u</th></tr></thead>
              <tbody>
                {events.length > TRACE_WINDOW && <tr><td colSpan={5} className="hint">Showing the last {TRACE_WINDOW} of {events.length} rows. Export the trace for all of them.</td></tr>}
                {shownEvents.map((e) => (
                  <tr key={e.step} className={e.step === current?.step ? 'current' : ''} onClick={() => { sim.setPlayhead(e.step); if (status === 'running') sim.pause(); }}>
                    <td className="numeric">{e.step}</td>
                    <td>{e.from === null ? <span className="subtle">start</span> : name(e.from)}</td>
                    <td><span className="swatch" style={{ background: stateColorVar(colorIndex.get(ids[e.to]) ?? 0), marginRight: 6 }} aria-hidden />{name(e.to)}</td>
                    <td className="numeric">{formatProbability(e.probability)}</td>
                    <td className="numeric subtle">{e.u.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!follow && <button className="btn btn-sm btn-ghost" style={{ marginTop: 4 }} onClick={() => setFollow(true)}>Follow current step</button>}
          {run?.trajectory.endReason === 'absorbed' && status === 'completed' && (
            <p className="hint" style={{ marginTop: 6 }}>Stopped at step {run.trajectory.events.length - 1}: {name(run.trajectory.events[run.trajectory.events.length - 1].to)} is absorbing.</p>
          )}
        </div>

        <div className="stack">
          <ExplainStep sim={sim} name={name} labelOf={labelOf} />
          {events.length > 1 && (
            <details>
              <summary className="hint" style={{ cursor: 'pointer' }}>Visits in this one path ({events.length} observations, t = 0…{current?.step})</summary>
              <div className="table-wrap" style={{ marginTop: 6 }}>
                <table className="table">
                  <thead><tr><th scope="col">State</th><th scope="col" className="numeric">Visits</th><th scope="col" className="numeric">Fraction</th></tr></thead>
                  <tbody>{[...visits.entries()].sort((a, b) => a[0] - b[0]).map(([i, n]) => (
                    <tr key={i}><td>{name(i)}</td><td className="numeric">{n}</td><td className="numeric">{(n / events.length).toFixed(3)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="hint" style={{ marginTop: 6 }}>Empirical frequencies of a single random path. They are not the exact distribution μₜ and do not prove the chain has reached a steady state.</p>
            </details>
          )}
          <p className="hint" style={{ margin: 0 }}>
            One random realization with seed {run?.trajectory.config.seed ?? config.seed}, 1 step = 1 {unit}. The same seed and settings always give the same path; playback speed never changes it.
          </p>
        </div>
      </div>
    </div>
  );
}

function ExplainStep({ sim, name, labelOf }: { sim: Simulation; name: (i: number | null) => string; labelOf: (id: StateId) => string }) {
  const { run, current } = sim;
  if (!run || !current) return <div className="empty-state" style={{ padding: 16 }}><p>Press Play or Step to draw a random path.</p></div>;
  const ids = run.trajectory.stateIds;
  const source = current.from;
  return (
    <div className="result-card">
      <div className="kpi-label">Explain this step</div>
      {source === null ? (
        <p style={{ margin: '4px 0' }}><strong>t = 0:</strong> the starting state is drawn from {sim.config.start === 'mu0' ? 'the starting distribution μ₀' : `a fixed start (${labelOf(sim.config.start)})`}. Draw u = <span className="num">{current.u.toFixed(4)}</span> landed in [{formatProbability(current.interval[0])}, {formatProbability(current.interval[1])}) → <strong>{name(current.to)}</strong>.</p>
      ) : (
        <p style={{ margin: '4px 0' }}>
          <strong>t = {current.step}:</strong> from <strong>{name(source)}</strong>, the row's positive probabilities are laid end to end on [0, 1).
          Draw u = <span className="num">{current.u.toFixed(4)}</span> fell in [{formatProbability(current.interval[0])}, {formatProbability(current.interval[1])}), the interval for <strong>{name(current.to)}</strong> (p = {formatProbability(current.probability)}).
        </p>
      )}
      <IntervalBar sim={sim} ids={ids} name={name} />
      <p className="hint" style={{ margin: '6px 0 0' }}>A probability is not a guarantee: a different draw could have picked another destination.</p>
    </div>
  );
}

function IntervalBar({ sim, ids, name }: { sim: Simulation; ids: readonly StateId[]; name: (i: number | null) => string }) {
  const { run, current } = sim;
  if (!run || !current) return null;
  const row = buildCdfRow(current.from === null ? run.initial : run.chain.P[current.from]);
  return (
    <div className="interval-bar" role="img" aria-label={`Draw ${current.u.toFixed(4)} on the interval from 0 to 1, landing on ${name(current.to)}`}>
      {row.targets.map((t, k) => {
        const lo = k ? row.bounds[k - 1] : 0;
        const chosen = t === current.to;
        return (
          <div key={t} className={`interval-seg${chosen ? ' chosen' : ''}`} style={{ left: `${lo * 100}%`, width: `${(row.bounds[k] - lo) * 100}%` }} title={`${name(t)}: [${formatProbability(lo)}, ${formatProbability(row.bounds[k])})`}>
            <span>{name(t)}</span>
          </div>
        );
      })}
      <div className="interval-u" style={{ left: `${current.u * 100}%` }} />
      <span className="visually-hidden">{ids.length} states</span>
    </div>
  );
}
