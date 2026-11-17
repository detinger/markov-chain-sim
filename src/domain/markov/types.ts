// Canonical project document and computation contracts (PLAN.md §7.3).
// Pure types — no React, storage, or renderer dependencies.

export type StateId = string;

export interface ChainState {
  id: StateId;
  label: string;
  description?: string;
}

export interface Transition {
  from: StateId;
  to: StateId;
  probability: number;
}

export interface InitialEntry {
  stateId: StateId;
  probability: number;
}

export interface ChainDocumentV1 {
  schemaVersion: 1;
  id: string;
  title: string;
  /** Incremented when probabilities, states, or the initial distribution change. */
  modelRevision: number;
  /** Incremented for coordinates, viewport, or other display-only edits. */
  layoutRevision: number;
  stateOrder: StateId[];
  states: ChainState[];
  transitions: Transition[];
  initial: InitialEntry[];
  layout: {
    positions: Record<StateId, { x: number; y: number }>;
    viewport?: { x: number; y: number; zoom: number };
    colors?: Record<StateId, string>;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    description?: string;
    stepLabel?: string;
    exampleId?: string;
    exampleVersion?: number;
  };
}

export interface CompiledChain {
  /** Stable serialization of ordered state IDs, P, and μ₀ (excludes labels/layout). */
  modelHash: string;
  stateIds: readonly StateId[];
  P: readonly (readonly number[])[];
  initial: readonly number[];
  /** Rows/initial vector rescaled because their sum was within εrow of 1 but not exactly 1. */
  adjustments: readonly { location: string; beforeSum: number }[];
}

export type ScalarResult =
  | { kind: 'finite'; value: number }
  | { kind: 'infinite' }
  | { kind: 'undefined'; reason: string };

export type AnalysisOutcome<T> =
  | { status: 'ok'; result: T; method: string; residual?: number; warnings: string[]; modelHash: string }
  | { status: 'invalid' | 'unsupported' | 'numerical-failure'; issues: string[]; modelHash?: string };

export type Severity = 'error' | 'warning' | 'recommendation' | 'info';

export interface ValidationIssue {
  code: string;
  severity: Severity;
  title: string;
  explanation: string;
  /** Where the issue lives: a state row, a single cell, the initial vector, or the whole document. */
  target:
    | { kind: 'row'; stateId: StateId }
    | { kind: 'cell'; from: StateId; to: StateId }
    | { kind: 'initial' }
    | { kind: 'document' };
  /** Repairs the UI may offer as explicit, undoable commands. */
  repairs?: RepairKind[];
}

export type RepairKind = 'normalize-row' | 'make-absorbing' | 'distribute-equally' | 'normalize-initial';
