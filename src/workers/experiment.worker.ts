/// <reference lib="webworker" />
import { EXPERIMENT_ENGINE, emptyAccumulator, runReplications, validateExperimentConfig } from '../domain/simulation';
import type { WorkerRequest, WorkerResponse } from './protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const cancelled = new Set<string>();
const post = (m: WorkerResponse, transfer: Transferable[] = []) => ctx.postMessage(m, transfer);
const yieldToMessages = () => new Promise<void>((r) => setTimeout(r, 0));

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'cancel') { cancelled.add(msg.jobId); return; }
  const { jobId, modelHash, chain, config } = msg;
  try {
    if (msg.engine !== EXPERIMENT_ENGINE) throw new Error(`Engine mismatch: ${msg.engine}`);
    const errors = validateExperimentConfig(chain, config);
    if (errors.length) throw new Error(errors.join(' '));
    const start = performance.now();
    const acc = emptyAccumulator(chain.P.length, config.horizon);
    // ~200k transitions per batch keeps cancellation latency far below 500 ms.
    const batch = Math.max(1, Math.floor(200_000 / (config.horizon + 1)));
    let lastProgress = 0;
    let status: 'completed' | 'cancelled' = 'completed';
    for (let from = 0; from < config.replications; from += batch) {
      const to = Math.min(config.replications, from + batch);
      runReplications(chain, config, from, to, acc);
      const now = performance.now();
      if (now - lastProgress >= 100 || to === config.replications) {
        post({ type: 'progress', jobId, modelHash, completed: to, total: config.replications });
        lastProgress = now;
      }
      await yieldToMessages();
      if (cancelled.has(jobId)) { status = 'cancelled'; break; }
    }
    cancelled.delete(jobId);
    post({ type: 'result', jobId, modelHash, status, acc, elapsedMs: performance.now() - start },
      [acc.endpoint.buffer, acc.occSum.buffer, acc.occSumSq.buffer, acc.hitHist.buffer]);
  } catch (err) {
    post({ type: 'error', jobId, modelHash, message: err instanceof Error ? err.message : String(err) });
  }
};
