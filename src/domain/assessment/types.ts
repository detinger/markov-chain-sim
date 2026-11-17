import type { StateId } from '../markov/types';

/** Compact, versionable model fixture used by lessons and challenges. */
export interface ModelSnapshot {
  title: string;
  states: { id: StateId; label: string; x: number; y: number }[];
  /** Dense matrix in `states` order. May be intentionally invalid in a repair-challenge starter. */
  P: number[][];
  mu0: number[];
  stepLabel?: string;
}

/** A quantity the learner must compute; the expected value is always derived from the model, never typed in. */
export type NumericTarget =
  | { type: 'path'; path: StateId[]; mode: 'joint' | 'conditional' }
  | { type: 'distribution'; t: number; state: StateId }
  /** π(state) of the unique stationary distribution. */
  | { type: 'stationary'; state: StateId }
  /** Pr(eventually absorbed in `into` | X₀ = from). */
  | { type: 'absorb'; from: StateId; into: StateId }
  /** Expected steps to absorption from `from`. */
  | { type: 'expected-steps'; from: StateId }
  /** Pr(T_A ≤ t) from μ₀ (first arrival, not occupancy). */
  | { type: 'hit-by'; targets: StateId[]; t: number };

/** Structural sets the learner identifies by ticking states. */
export type StateSetTarget = 'closed' | 'transient' | 'absorbing';

export type Assertion =
  | { kind: 'rows-valid' }
  | { kind: 'initial-valid' }
  | { kind: 'state-count'; equals: number }
  /** P[role(from)][role(to)] must equal `value` within `tolerance`. */
  | { kind: 'transition'; from: string; to: string; value: number; tolerance: number }
  /** Keep a transition positive (prevents trivial "make everything absorbing" repairs). */
  | { kind: 'transition-positive'; from: string; to: string; why: string }
  | { kind: 'numeric-answer'; key: string; label: string; target: NumericTarget; tolerance: number }
  /** Multiple choice; `explanations[i]` says why choice i is right or wrong (shown after checking). */
  | { kind: 'choice-answer'; key: string; label: string; question: string; choices: string[]; correct: number; explanations: string[] }
  /** The learner ticks the states that form a structural set, computed from the model. */
  | { kind: 'state-set'; key: string; label: string; target: StateSetTarget; why: string }
  /** Rows listed in the challenge's `lockedRows` must equal the starter exactly. */
  | { kind: 'rows-locked' }
  /** min ≤ P[from][to] ≤ max — a scenario constraint on an editable row. */
  | { kind: 'transition-range'; from: string; to: string; min: number; max: number; why: string }
  /** An exact model metric must meet a threshold; feedback compares it with the starter (baseline). */
  | { kind: 'metric'; metric: ModelMetric; op: 'at-most' | 'at-least'; value: number; why: string };

/** Exact metrics from μ₀ used by comparison-style challenges. */
export type ModelMetric =
  | { type: 'mean-hit'; targets: StateId[]; label: string; unit: string }
  | { type: 'hit-by'; targets: StateId[]; horizon: number; label: string }
  | { type: 'absorb'; state: StateId; label: string };

export interface ChallengeDefinition {
  id: string;
  version: number;
  /** Oldest version whose saved progress stays valid (e.g. only wording changed). */
  progressCompatibleFrom?: number;
  title: string;
  level: number;
  prerequisites: string[];
  objective: string;
  scenario: string[];
  /** 'model' challenges are edited; 'numeric' challenges are answered from a read-only model. */
  mode: 'model' | 'numeric';
  starter: ModelSnapshot;
  /** Semantic roles the learner maps onto their own states (permutation-tolerant grading). */
  roles?: string[];
  /** State IDs whose rows the learner may not edit. */
  lockedRows?: StateId[];
  allowStructureEdits: boolean;
  assertions: Assertion[];
  hints: string[];
  rubric: string;
  /** A correct solution; tests assert it passes and the starter fails. */
  reference: { snapshot?: ModelSnapshot; roleMap?: Record<string, StateId>; answers?: Record<string, number | string> };
  /** Optional fixed, seeded Monte Carlo runs shown with the model (deterministic: same seeds, same numbers). */
  experiment?: { horizon: number; state: StateId; runs: { label: string; replications: number; seed: number }[] };
  nextConcept: string;
}

export interface Submission {
  snapshot: ModelSnapshot;
  roleMap: Record<string, StateId>;
  answers: Record<string, string>;
}

export interface AssertionResult {
  passed: boolean;
  /** Short rubric criterion this assertion checks (shown as a checklist). */
  criterion: string;
  message: string;
}

export interface AssessmentResult {
  challengeId: string;
  version: number;
  passed: boolean;
  correct: string[];
  needsAttention: { message: string; why: string }[];
  next: string;
  results: AssertionResult[];
}
