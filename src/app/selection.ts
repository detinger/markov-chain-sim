import type { StateId } from '../domain/markov';

export type Selection =
  | { kind: 'state'; id: StateId }
  | { kind: 'transition'; from: StateId; to: StateId }
  | null;
