// Typed experiment-worker protocol (PLAN.md §7.5). Every message echoes jobId and modelHash.
import type { CompiledChain } from '../domain/markov';
import type { Accumulator, ExperimentConfig } from '../domain/simulation';

export type WorkerRequest =
  | { type: 'run'; jobId: string; modelHash: string; engine: string; chain: CompiledChain; config: ExperimentConfig }
  | { type: 'cancel'; jobId: string };

export type WorkerResponse =
  | { type: 'progress'; jobId: string; modelHash: string; completed: number; total: number }
  | { type: 'result'; jobId: string; modelHash: string; status: 'completed' | 'cancelled'; acc: Accumulator; elapsedMs: number }
  | { type: 'error'; jobId: string; modelHash: string; message: string };
