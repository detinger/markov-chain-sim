import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompiledChain, StateId } from '../../domain/markov';
import { EXPERIMENT_ENGINE, summarizeExperiment, type Accumulator, type ExperimentConfig, type ExperimentSummary } from '../../domain/simulation';
import type { WorkerRequest, WorkerResponse } from '../../workers/protocol';

export type ExperimentStatus = 'idle' | 'running' | 'cancelling' | 'completed' | 'cancelled' | 'error';

export interface ExperimentResult {
  jobId: string;
  status: 'completed' | 'cancelled';
  chain: CompiledChain;
  config: ExperimentConfig;
  acc: Accumulator;
  summary: ExperimentSummary;
  labels: Record<StateId, string>;
  startedAt: string;
  finishedAt: string;
  elapsedMs: number;
}

/** Orchestrates the experiment worker; late messages for obsolete jobs are discarded. */
export function useExperiment() {
  const worker = useRef<Worker | null>(null);
  const job = useRef<{ id: string; chain: CompiledChain; config: ExperimentConfig; labels: Record<StateId, string>; startedAt: string } | null>(null);
  const [status, setStatus] = useState<ExperimentStatus>('idle');
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getWorker = useCallback(() => {
    if (worker.current) return worker.current;
    const w = new Worker(new URL('../../workers/experiment.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const current = job.current;
      if (!current || msg.jobId !== current.id || msg.modelHash !== current.chain.modelHash) return; // stale
      if (msg.type === 'progress') setProgress({ completed: msg.completed, total: msg.total });
      else if (msg.type === 'error') { setError(msg.message); setStatus('error'); job.current = null; }
      else {
        setResult({
          jobId: msg.jobId, status: msg.status, chain: current.chain, config: current.config, acc: msg.acc,
          summary: summarizeExperiment(current.chain, current.config, msg.acc),
          labels: current.labels, startedAt: current.startedAt, finishedAt: new Date().toISOString(), elapsedMs: msg.elapsedMs,
        });
        setStatus(msg.status);
        job.current = null;
      }
    };
    w.onerror = (e) => { setError(e.message || 'The experiment worker failed to start.'); setStatus('error'); job.current = null; };
    worker.current = w;
    return w;
  }, []);

  useEffect(() => () => worker.current?.terminate(), []);

  const run = useCallback((chain: CompiledChain, config: ExperimentConfig, labels: Record<StateId, string>) => {
    if (job.current) worker.current?.postMessage({ type: 'cancel', jobId: job.current.id } satisfies WorkerRequest);
    const id = `job-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    job.current = { id, chain, config, labels, startedAt: new Date().toISOString() };
    setError(null);
    setProgress({ completed: 0, total: config.replications });
    setStatus('running');
    getWorker().postMessage({ type: 'run', jobId: id, modelHash: chain.modelHash, engine: EXPERIMENT_ENGINE, chain, config } satisfies WorkerRequest);
  }, [getWorker]);

  const cancel = useCallback(() => {
    if (!job.current) return;
    worker.current?.postMessage({ type: 'cancel', jobId: job.current.id } satisfies WorkerRequest);
    setStatus('cancelling');
  }, []);

  return { status, progress, result, error, run, cancel };
}
