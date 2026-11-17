import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChainDocumentV1, CompiledChain, StateId } from '../../domain/markov';
import { MAX_SEED, simulateTrajectory, type Trajectory } from '../../domain/simulation';

export type RunStatus = 'ready' | 'running' | 'paused' | 'stopped' | 'completed';
export const SPEEDS = [0.5, 1, 2, 4, 8] as const; // steps per second

export interface SimConfig {
  seed: number;
  horizon: number;
  /** 'mu0' samples X₀ from the model's starting distribution; a state ID forces a point mass there. */
  start: 'mu0' | StateId;
  stopOnAbsorption: boolean;
  speed: (typeof SPEEDS)[number];
}

export interface SimRun {
  trajectory: Trajectory;
  /** Immutable model snapshot the run was drawn from, and the start vector actually used. */
  chain: CompiledChain;
  initial: readonly number[];
  /** Label snapshot so an old run stays readable after renames/deletions. */
  labels: Record<StateId, string>;
}

function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % (MAX_SEED + 1);
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * Playback over a precomputed, seeded trajectory (ADR 0002). The playhead is presentation state:
 * play/pause/speed/step/rewind never consume random draws.
 */
export function useSimulation(doc: ChainDocumentV1, chain: CompiledChain | null) {
  const [config, setConfigState] = useState<SimConfig>(() => ({ seed: randomSeed(), horizon: 50, start: 'mu0', stopOnAbsorption: true, speed: 2 }));
  const [run, setRun] = useState<SimRun | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [status, setStatus] = useState<RunStatus>('ready');

  const build = useCallback((cfg: SimConfig): SimRun | null => {
    if (!chain) return null;
    const startIdx = cfg.start === 'mu0' ? -1 : chain.stateIds.indexOf(cfg.start);
    const initial = startIdx >= 0 ? chain.stateIds.map((_, i) => (i === startIdx ? 1 : 0)) : undefined;
    const trajectory = simulateTrajectory(chain, { seed: cfg.seed, stream: 0, horizon: cfg.horizon, initial, stopOnAbsorption: cfg.stopOnAbsorption });
    return { trajectory, chain, initial: initial ?? chain.initial, labels: Object.fromEntries(doc.states.map((s) => [s.id, s.label])) };
  }, [chain, doc.states]);

  /** Reset: recreate the same run from the seed and configuration, with the current model. */
  const reset = useCallback((cfg = config) => {
    setRun(build(cfg));
    setPlayhead(0);
    setStatus('ready');
  }, [build, config]);

  const modelChanged = !!run && (!chain || run.trajectory.modelHash !== chain.modelHash);

  // Edits pause an active run; an unstarted run simply follows the model. The old run stays inspectable.
  const lastHash = useRef<string | null>(null);
  useEffect(() => {
    const hash = chain?.modelHash ?? null;
    if (hash === lastHash.current) return;
    lastHash.current = hash;
    if (status === 'running') setStatus('paused');
    else if (status === 'ready' && playhead === 0) { setRun(build(config)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain?.modelHash]);

  // Keep the start override valid if that state is deleted.
  useEffect(() => {
    if (config.start !== 'mu0' && !doc.stateOrder.includes(config.start)) setConfigState((c) => ({ ...c, start: 'mu0' }));
  }, [doc.stateOrder, config.start]);

  const setConfig = useCallback((patch: Partial<SimConfig>) => {
    const next = { ...config, ...patch };
    setConfigState(next);
    // Speed is presentation only; every other change defines a new run.
    if (Object.keys(patch).some((k) => k !== 'speed')) { setRun(build(next)); setPlayhead(0); setStatus('ready'); }
  }, [config, build]);

  const lastIndex = run ? run.trajectory.events.length - 1 : 0;

  // The playback clock: one timer per step. Rendering never drives mathematical time.
  useEffect(() => {
    if (status !== 'running' || !run) return;
    if (playhead >= lastIndex) { setStatus('completed'); return; }
    const t = setTimeout(() => setPlayhead((p) => p + 1), 1000 / config.speed);
    return () => clearTimeout(t);
  }, [status, playhead, lastIndex, run, config.speed]);

  const ensureRun = useCallback(() => {
    if (run && !modelChanged) return run;
    const r = build(config);
    setRun(r);
    setPlayhead(0);
    return r;
  }, [run, modelChanged, build, config]);

  const play = useCallback(() => {
    if (!chain) return;
    if (status === 'completed' || status === 'stopped' || modelChanged) { reset(); setStatus('running'); return; }
    ensureRun();
    setStatus('running');
  }, [chain, status, modelChanged, reset, ensureRun]);

  const pause = useCallback(() => setStatus((s) => (s === 'running' ? 'paused' : s)), []);
  const stop = useCallback(() => setStatus((s) => (s === 'ready' ? s : 'stopped')), []);

  /** Step advances exactly one transition. */
  const step = useCallback(() => {
    const fresh = !run || modelChanged || status === 'stopped' || status === 'completed';
    const r = fresh ? build(config) : run;
    if (!r) return;
    if (fresh) setRun(r);
    const last = r.trajectory.events.length - 1;
    const next = Math.min((fresh ? 0 : playhead) + 1, last);
    setPlayhead(next);
    setStatus(next >= last ? 'completed' : 'paused');
  }, [run, modelChanged, status, build, config, playhead]);

  /** Rewind replays recorded history; it never resamples. */
  const stepBack = useCallback(() => {
    if (!run) return;
    setPlayhead(Math.max(0, playhead - 1));
    setStatus(playhead - 1 <= 0 && status === 'ready' ? 'ready' : 'paused');
  }, [run, playhead, status]);

  const newSeed = useCallback(() => setConfig({ seed: randomSeed() }), [setConfig]);

  // Build the first run once a valid model exists.
  useEffect(() => {
    if (!run && chain) setRun(build(config));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain]);

  const current = run?.trajectory.events[Math.min(playhead, lastIndex)] ?? null;
  const overlay = useMemo(() => {
    if (!run || !current || modelChanged && !chain) return null;
    const ids = run.trajectory.stateIds;
    return {
      stateId: ids[current.to],
      edge: current.from === null ? null : { from: ids[current.from], to: ids[current.to] },
      step: current.step,
      key: `${run.trajectory.config.seed}-${current.step}`,
    };
  }, [run, current, modelChanged, chain]);

  return {
    config, setConfig, newSeed, run, playhead, status, current, lastIndex, modelChanged, overlay,
    play, pause, stop, reset: () => reset(), step, stepBack, setPlayhead,
  };
}

export type Simulation = ReturnType<typeof useSimulation>;
