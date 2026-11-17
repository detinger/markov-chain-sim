import { useMemo, useState } from 'react';
import { snapshotToDocument, type ModelSnapshot } from '../../domain/assessment';
import { compileChain, formatProbability, type CompiledChain } from '../../domain/markov';
import { runReplications, summarizeExperiment, type ExperimentConfig, type ExperimentSummary } from '../../domain/simulation';
import MiniChain from './MiniChain';

/** Deterministic, synchronous small experiment (≤ 5,000 × short horizon) for teaching; pure engine, fixed seed. */
export function runSmallExperiment(chain: CompiledChain, horizon: number, replications: number, seed: number, targetIds: string[] = []): ExperimentSummary {
  const config: ExperimentConfig = { schemaVersion: 1, modelHash: chain.modelHash, seed, replications, horizon, burnIn: 0, targetIds, traceLimit: 0 };
  return summarizeExperiment(chain, config, runReplications(chain, config, 0, replications));
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const sub = (n: number) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);

function useChain(snapshot: ModelSnapshot) {
  return useMemo(() => { const c = compileChain(snapshotToDocument(snapshot)); return c.status === 'ok' ? c.result : null; }, [snapshot]);
}

/** One row per run: estimate, 95% Wilson interval with a visual bar, and the exact value. */
export function RunTable({ snapshot, horizon, state, runs }: { snapshot: ModelSnapshot; horizon: number; state: string; runs: { label: string; replications: number; seed: number }[] }) {
  const chain = useChain(snapshot);
  const rows = useMemo(() => (chain ? runs.map((r) => ({ ...r, s: runSmallExperiment(chain, horizon, r.replications, r.seed) })) : []), [chain, horizon, runs]);
  if (!chain) return null;
  const i = chain.stateIds.indexOf(state);
  const exact = rows[0]?.s.exactEndpoint[horizon][i] ?? 0;
  const name = snapshot.states.find((x) => x.id === state)?.label ?? state;
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">Monte Carlo estimates of μ{sub(horizon)}({name}) with 95% Wilson intervals and the exact value</caption>
        <thead><tr><th scope="col">Run</th><th scope="col" className="numeric">Replications</th><th scope="col" className="numeric">Seed</th><th scope="col" className="numeric">Estimate</th><th scope="col" className="numeric">95% interval</th><th scope="col" style={{ width: '30%' }}>Interval vs exact</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const ci = r.s.endpoint[horizon][i];
            if (!ci) return null;
            const contains = ci.lower <= exact && exact <= ci.upper;
            return (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="numeric">{r.replications.toLocaleString()}</td>
                <td className="numeric">{r.seed}</td>
                <td className="numeric">{formatProbability(ci.estimate, 4)}</td>
                <td className="numeric">[{formatProbability(ci.lower, 4)}, {formatProbability(ci.upper, 4)}]</td>
                <td>
                  <div className="ci-bar" aria-label={`Interval ${pct(ci.lower)} to ${pct(ci.upper)}; exact ${pct(exact)} ${contains ? 'inside' : 'outside'} the interval`} role="img">
                    <span className="ci-range" style={{ left: `${ci.lower * 100}%`, width: `${Math.max(0.5, (ci.upper - ci.lower) * 100)}%` }} />
                    <span className="ci-point" style={{ left: `${ci.estimate * 100}%` }} />
                    <span className="ci-exact" style={{ left: `${exact * 100}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hint" style={{ marginTop: 6 }}>Exact μ{sub(horizon)}({name}) = {formatProbability(exact, 4)} (vertical line). Dot = estimate, bar = pointwise 95% Wilson interval. Same seed, same numbers.</p>
    </div>
  );
}

const SIZES = [20, 50, 200, 1000, 5000];

/** Lesson demo: pick M, see the estimate and interval move, compare with exact. Optional target shows censoring. */
export function ExperimentDemo({ snapshot, caption, horizon, state, seed, target }: { snapshot: ModelSnapshot; caption: string; horizon: number; state: string; seed: number; target?: string[] }) {
  const chain = useChain(snapshot);
  const [m, setM] = useState(50);
  const [s, setSeed] = useState(seed);
  const summary = useMemo(() => (chain ? runSmallExperiment(chain, horizon, m, s, target ?? []) : null), [chain, horizon, m, s, target]);
  if (!chain || !summary) return null;
  const name = (id: string) => snapshot.states.find((x) => x.id === id)?.label ?? id;
  const h = summary.hitting;
  return (
    <section className="lesson-section card demo">
      <div className="row" style={{ justifyContent: 'space-between' }}><strong>Interactive: {caption}</strong><span className="badge">Simulated · seed {s}</span></div>
      <div className="demo-grid">
        <MiniChain snapshot={snapshot} height={180} />
        <div>
          <p className="hint" style={{ marginTop: 0 }}>Replications M (independent runs). Each choice reruns the same seed.</p>
          <div className="row" role="group" aria-label="Replications" style={{ gap: 6, marginBottom: 8 }}>
            {SIZES.map((n) => <button key={n} className={`btn btn-sm${n === m ? ' btn-primary' : ''}`} aria-pressed={n === m} onClick={() => setM(n)}>M = {n.toLocaleString()}</button>)}
            <button className="btn btn-sm btn-ghost" onClick={() => setSeed((x) => (Math.imul(x, 1103515245) + 12345) >>> 0)}>New seed</button>
          </div>
        </div>
      </div>
      <RunTable snapshot={snapshot} horizon={horizon} state={state} runs={[{ label: `${m.toLocaleString()} runs`, replications: m, seed: s }]} />
      {h && (
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="table">
            <caption className="visually-hidden">First-hit results with censoring</caption>
            <tbody>
              <tr><th scope="row">Reached {target!.map(name).join(', ')} by step {horizon}</th><td className="numeric">{h.hitCount} of {m} ({pct(h.hitCount / m)}) · exact {pct(h.exactHitByHorizon)}</td></tr>
              <tr><th scope="row">Censored (not reached by step {horizon})</th><td className="numeric">{h.censoredCount}</td></tr>
              <tr><th scope="row">At {name(state)} at step {horizon}</th><td className="numeric">{pct(summary.endpoint[horizon][chain.stateIds.indexOf(state)]?.estimate ?? 0)} · exact {pct(summary.exactEndpoint[horizon][chain.stateIds.indexOf(state)])}</td></tr>
              <tr><th scope="row">Restricted mean E[min(T, {horizon})]</th><td className="numeric">{h.restrictedMean.mean.toFixed(3)} · exact {h.exactRestrictedMean.toFixed(3)}</td></tr>
              <tr><th scope="row">Mean among paths that hit (conditional on hitting by step {horizon})</th><td className="numeric">{h.meanAmongHits === null ? 'none hit' : h.meanAmongHits.toFixed(3)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
