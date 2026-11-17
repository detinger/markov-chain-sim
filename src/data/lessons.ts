// Versioned lesson content (PLAN.md Module B). Structure: explanation → visual example → interactive
// demonstration → common mistake → knowledge check. Answers to numeric checks are always computed from
// the lesson model, never hard-coded.
import type { ModelSnapshot, NumericTarget } from '../domain/assessment';

export type LessonSection =
  | { kind: 'text'; heading?: string; body: string[] }
  | { kind: 'formula'; text: string; spoken: string }
  | { kind: 'model'; snapshot: ModelSnapshot; caption: string; description: string }
  | { kind: 'demo-evolve'; snapshot: ModelSnapshot; caption: string; maxT: number }
  | { kind: 'demo-path'; snapshot: ModelSnapshot; caption: string }
  | { kind: 'mistake'; text: string }
  | { kind: 'check'; id: string; question: string; choices: string[]; correct: number; explanation: string }
  | { kind: 'numeric-check'; id: string; question: string; snapshot: ModelSnapshot; target: NumericTarget; tolerance: number; explanation: string }
  | { kind: 'try'; text: string; challengeId: string };

export interface Lesson {
  id: string;
  version: number;
  level: 1 | 2 | 3 | 4;
  title: string;
  objective: string;
  prerequisites: string[];
  minutes: number;
  sections: LessonSection[];
  next?: string;
}

export const LEVELS: Record<number, { title: string; outcome: string }> = {
  1: { title: 'Foundations', outcome: 'Build and validate a two-state model; explain Pᵢⱼ.' },
  2: { title: 'Evolution', outcome: 'Distinguish a specific path from all paths ending in a state.' },
  3: { title: 'Long-run behavior', outcome: 'Explain why stationary need not mean convergent.' },
  4: { title: 'Absorption', outcome: 'Separate eventual absorption, occupancy, and time to reach a target.' },
};

const s = (id: string, label: string, x: number, y: number) => ({ id, label, x, y });

export const WEATHER: ModelSnapshot = {
  title: 'Weather', stepLabel: 'day',
  states: [s('sun', 'Sunny', 0, 0), s('rain', 'Rainy', 260, 0)],
  P: [[0.8, 0.2], [0.4, 0.6]], mu0: [1, 0],
};
const WEATHER_HALF: ModelSnapshot = { ...WEATHER, mu0: [0.5, 0.5] };
export const ALTERNATOR: ModelSnapshot = {
  title: 'Alternator', states: [s('a', 'A', 0, 0), s('b', 'B', 260, 0)], P: [[0, 1], [1, 0]], mu0: [1, 0],
};
const REDUCIBLE: ModelSnapshot = {
  title: 'Classes',
  states: [s('a', 'A', 0, 80), s('b', 'B', 200, 0), s('c', 'C', 400, 80), s('d', 'D', 200, 200)],
  P: [[0.5, 0.5, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1]], mu0: [1, 0, 0, 0],
};
const GAMBLE: ModelSnapshot = {
  title: 'Ruin or riches', stepLabel: 'round',
  states: [s('play', 'Playing', 180, 0), s('ruin', 'Ruin', 0, 180), s('rich', 'Rich', 360, 180)],
  P: [[0.5, 0.2, 0.3], [0, 1, 0], [0, 0, 1]], mu0: [1, 0, 0],
};
const ERRANDS: ModelSnapshot = {
  title: 'Errands', stepLabel: 'hour',
  states: [s('home', 'Home', 0, 0), s('shop', 'Shop', 260, 0), s('cafe', 'Café', 130, 180)],
  P: [[0.5, 0.5, 0], [0.3, 0.2, 0.5], [0.4, 0, 0.6]], mu0: [1, 0, 0],
};

export const LESSONS: Lesson[] = [
  {
    id: 'foundations.states', version: 1, level: 1, minutes: 6,
    title: 'States and the Markov property',
    objective: 'Describe a system as a set of states and state what the Markov property assumes.',
    prerequisites: [],
    sections: [
      { kind: 'text', body: [
        'A Markov chain describes a system that is always in exactly one of a finite list of states, and that moves between states in discrete steps.',
        'The Markov property says that where the chain goes next depends only on where it is now — not on how it got there. Yesterday’s weather does not matter once you know today’s.',
        'A step is just an index t = 0, 1, 2, … A model can say what one step means (a day, a round, a minute), but the mathematics only counts steps.',
      ] },
      { kind: 'model', snapshot: WEATHER, caption: 'Two states: Sunny and Rainy. One step = one day.',
        description: 'Sunny stays Sunny with probability 0.8 and becomes Rainy with probability 0.2. Rainy becomes Sunny with probability 0.4 and stays Rainy with probability 0.6.' },
      { kind: 'mistake', text: 'Assuming a long sunny streak makes rain “due”. In a Markov chain the chance of rain tomorrow is 0.2 whenever today is sunny, however many sunny days came before.' },
      { kind: 'check', id: 'q1', question: 'Today is Sunny. Yesterday was Rainy. In this model, what is the probability that tomorrow is Rainy?',
        choices: ['0.6, because yesterday was Rainy', '0.2, because only today matters', '0.4, the average of the two rows'], correct: 1,
        explanation: 'Only the current state (Sunny) matters, so we read the Sunny row: P(Sunny → Rainy) = 0.2.' },
    ],
    next: 'foundations.rows',
  },
  {
    id: 'foundations.rows', version: 1, level: 1, minutes: 8,
    title: 'Transition probabilities and rows',
    objective: 'Read Pᵢⱼ from a matrix and explain why every row must total 1.',
    prerequisites: ['foundations.states'],
    sections: [
      { kind: 'text', body: [
        'Transition probabilities are arranged in a square matrix P. Rows are the current state (From); columns are the next state (To).',
        'Because the chain must be somewhere at the next step, the probabilities in each row add up to exactly 1. A self-loop — the diagonal entry Pᵢᵢ — is the probability of staying put.',
      ] },
      { kind: 'formula', text: 'Pᵢⱼ = Pr(Xₜ₊₁ = j | Xₜ = i),   Σⱼ Pᵢⱼ = 1', spoken: 'P i j is the probability that the next state is j given the current state is i; each row sums to one.' },
      { kind: 'model', snapshot: WEATHER, caption: 'Row Sunny = [0.8, 0.2]; row Rainy = [0.4, 0.6].',
        description: 'Matrix with rows Sunny (0.8 to Sunny, 0.2 to Rainy) and Rainy (0.4 to Sunny, 0.6 to Rainy). Each row totals 1.' },
      { kind: 'mistake', text: 'Reading down a column. The column Sunny = [0.8, 0.4] totals 1.2 — that is fine, columns do not need to total 1. Only rows describe “where do I go from here”.' },
      { kind: 'check', id: 'q1', question: 'A state has outgoing probabilities 0.5 and 0.3. What must the remaining entry of its row be?',
        choices: ['0.2', '0.8', 'Anything — rows do not need to total 1'], correct: 0,
        explanation: 'The row must total 1, so the remaining probability is 1 − 0.5 − 0.3 = 0.2.' },
      { kind: 'try', text: 'Build a two-state weather model from a written scenario.', challengeId: 'build-weather' },
      { kind: 'try', text: 'Repair a model whose rows do not total 1.', challengeId: 'repair-row' },
    ],
    next: 'evolution.one-step',
  },
  {
    id: 'evolution.one-step', version: 1, level: 2, minutes: 8,
    title: 'Starting distribution and one step',
    objective: 'Compute μ₁ = μ₀P from a starting distribution.',
    prerequisites: ['foundations.rows'],
    sections: [
      { kind: 'text', body: [
        'When we are unsure where the chain starts, we use a starting distribution μ₀: a row vector of probabilities, one per state, totalling 1. Choosing a single starting state is the special case where one entry is 1.',
        'After one step, the probability of being in state j adds up every way to arrive there: start in i (probability μ₀(i)) and then move i → j (probability Pᵢⱼ).',
      ] },
      { kind: 'formula', text: 'μ₁(j) = Σᵢ μ₀(i) · Pᵢⱼ   (μ₁ = μ₀P)', spoken: 'mu one of j equals the sum over i of mu zero of i times P i j.' },
      { kind: 'model', snapshot: WEATHER_HALF, caption: 'Start: 50% Sunny, 50% Rainy.',
        description: 'Weather model with starting distribution 0.5 Sunny and 0.5 Rainy.' },
      { kind: 'mistake', text: 'Multiplying the matrix by the vector from the wrong side. μ₀ is a row vector on the left: μ₀P, which uses the rows of P.' },
      { kind: 'numeric-check', id: 'q1', question: 'Starting 50% Sunny and 50% Rainy, what is the probability of Rainy after one day?',
        snapshot: WEATHER_HALF, target: { type: 'distribution', t: 1, state: 'rain' }, tolerance: 1e-6,
        explanation: 'μ₁(Rainy) = 0.5 × 0.2 + 0.5 × 0.6 = 0.1 + 0.3 = 0.4.' },
    ],
    next: 'evolution.n-step',
  },
  {
    id: 'evolution.n-step', version: 1, level: 2, minutes: 10,
    title: 'Evolution over many steps',
    objective: 'Use μₜ = μ₀Pᵗ and read (Pᵗ)ᵢⱼ correctly.',
    prerequisites: ['evolution.one-step'],
    sections: [
      { kind: 'text', body: [
        'Repeating the one-step rule gives the whole evolution: μ₂ = μ₁P = μ₀P², and in general μₜ = μ₀Pᵗ.',
        'The entry (Pᵗ)ᵢⱼ is the probability of being in j exactly t steps after being in i.',
      ] },
      { kind: 'demo-evolve', snapshot: WEATHER, maxT: 15, caption: 'Move the slider to step through μₜ starting from Sunny.' },
      { kind: 'mistake', text: '(Pᵗ)ᵢⱼ is not the probability of reaching j for the first time at step t — the chain may have visited j earlier and come back.' },
      { kind: 'numeric-check', id: 'q1', question: 'Starting Sunny, what is the probability of Rainy after exactly two days?',
        snapshot: WEATHER, target: { type: 'distribution', t: 2, state: 'rain' }, tolerance: 1e-6,
        explanation: 'Two routes end in Rainy: Sunny→Sunny→Rainy (0.8 × 0.2 = 0.16) and Sunny→Rainy→Rainy (0.2 × 0.6 = 0.12). Total 0.28.' },
      { kind: 'try', text: 'Predict a two-step probability by summing paths.', challengeId: 'predict-two-steps' },
    ],
    next: 'evolution.paths',
  },
  {
    id: 'evolution.paths', version: 1, level: 2, minutes: 10,
    title: 'Paths: joint and conditional probability',
    objective: 'Distinguish the probability of one specific path from the probability of ending in a state.',
    prerequisites: ['evolution.n-step'],
    sections: [
      { kind: 'text', body: [
        'A path is a specific sequence of states x₀ → x₁ → … → xₖ. Its probability multiplies one factor per transition.',
        'The joint probability also includes the chance of starting in x₀. The conditional probability assumes the start and multiplies transitions only.',
      ] },
      { kind: 'formula', text: 'Joint: μ₀(x₀) · Π Pₓᵣₓᵣ₊₁      Given start: Π Pₓᵣₓᵣ₊₁', spoken: 'Joint probability is mu zero of the first state times the product of transition probabilities; given the start, it is just the product.' },
      { kind: 'demo-path', snapshot: WEATHER, caption: 'Build a path and switch between joint and given-start modes.' },
      { kind: 'mistake', text: 'Confusing one path with all paths. Pr(Sunny → Rainy → Rainy) = 0.12 is only one of the routes to “Rainy on day 2”, whose probability is 0.28.' },
      { kind: 'numeric-check', id: 'q1', question: 'Given that today is Sunny, what is the probability of the path Sunny → Rainy → Rainy?',
        snapshot: WEATHER, target: { type: 'path', path: ['sun', 'rain', 'rain'], mode: 'conditional' }, tolerance: 1e-6,
        explanation: 'P(Sunny→Rainy) × P(Rainy→Rainy) = 0.2 × 0.6 = 0.12.' },
      { kind: 'check', id: 'q2', question: 'Which is larger: Pr(X₂ = Rainy | X₀ = Sunny) or Pr(Sunny → Rainy → Rainy | X₀ = Sunny)?',
        choices: ['The specific path', 'Being Rainy at step 2', 'They are always equal'], correct: 1,
        explanation: 'Being Rainy at step 2 includes every path that ends there, so it is at least as large as any single path (0.28 ≥ 0.12).' },
      { kind: 'try', text: 'Compute a joint and a conditional path probability.', challengeId: 'predict-path' },
    ],
    next: 'longrun.classes',
  },
  {
    id: 'longrun.classes', version: 1, level: 3, minutes: 10,
    title: 'Communicating classes',
    objective: 'Identify communicating classes, closed classes, and transient states from the graph.',
    prerequisites: ['evolution.paths'],
    sections: [
      { kind: 'text', body: [
        'Two states communicate if each can reach the other through positive-probability transitions. Communicating states form a class.',
        'A class is closed if no transition leaves it. In a finite chain, closed classes are recurrent (the chain keeps returning) and all other states are transient (eventually left for good). A chain with a single class is irreducible.',
      ] },
      { kind: 'model', snapshot: REDUCIBLE, caption: 'Four states, three classes.',
        description: 'A stays with 0.5 or moves to B with 0.5. B always goes to C and C always goes back to B. D only loops to itself and cannot be reached from A.' },
      { kind: 'mistake', text: 'Calling an unreachable state an error. D is valid: it is its own closed class that the chain never visits from A. Reducible chains are perfectly runnable.' },
      { kind: 'check', id: 'q1', question: 'Which state is transient?', choices: ['A', 'B', 'D'], correct: 0,
        explanation: 'From A the chain can go to B, but nothing leads back to A. {B, C} and {D} are closed.' },
    ],
    next: 'longrun.stationary',
  },
  {
    id: 'longrun.stationary', version: 1, level: 3, minutes: 12,
    title: 'Stationary is not the same as convergent',
    objective: 'Explain why a chain can have a stationary distribution without μₜ converging to it.',
    prerequisites: ['longrun.classes'],
    sections: [
      { kind: 'text', body: [
        'A stationary distribution π satisfies πP = π: if the chain starts with distribution π, it keeps that distribution forever. Every finite chain has at least one; an irreducible chain has exactly one.',
        'Convergence μₜ → π additionally needs aperiodicity. If returns to a state are only possible at multiples of some period d > 1, μₜ can oscillate forever.',
      ] },
      { kind: 'formula', text: 'πP = π,   π ≥ 0,   Σ π = 1', spoken: 'pi times P equals pi, with nonnegative entries totalling one.' },
      { kind: 'demo-evolve', snapshot: ALTERNATOR, maxT: 10, caption: 'A always goes to B and B always goes to A. Watch μₜ from A.' },
      { kind: 'mistake', text: 'Treating the last value of a simulation or chart as “the limit”. For the alternator, μₜ flips between [1, 0] and [0, 1], yet π = [0.5, 0.5] is stationary and is the long-run average.' },
      { kind: 'check', id: 'q1', question: 'For the alternator, which statement is true?',
        choices: ['μₜ converges to [0.5, 0.5] from A', 'π = [0.5, 0.5] is stationary but μₜ from A does not converge', 'There is no stationary distribution'], correct: 1,
        explanation: 'The chain has period 2. π = [0.5, 0.5] satisfies πP = π, but starting from A the distribution alternates.' },
    ],
    next: 'absorption.outcomes',
  },
  {
    id: 'absorption.outcomes', version: 1, level: 4, minutes: 12,
    title: 'Absorbing states and eventual outcomes',
    objective: 'Compute eventual absorption probabilities and expected time to absorption.',
    prerequisites: ['longrun.classes'],
    sections: [
      { kind: 'text', body: [
        'A state is absorbing when its self-loop has probability 1. Once entered, it is never left. When every transient state eventually leads to absorbing states, we can ask where the chain ends up and how long that takes.',
        'Ordering transient states first gives blocks Q (transient → transient) and R (transient → absorbing). The fundamental matrix N = (I − Q)⁻¹ counts expected visits; B = NR gives absorption probabilities and t = N1 the expected number of steps.',
      ] },
      { kind: 'formula', text: 'B = (I − Q)⁻¹ R,   t = (I − Q)⁻¹ 1', spoken: 'B equals I minus Q inverse times R; t equals I minus Q inverse times a vector of ones.' },
      { kind: 'model', snapshot: GAMBLE, caption: 'Each round: 50% keep playing, 20% Ruin, 30% Rich.',
        description: 'Playing returns to Playing with 0.5, goes to Ruin with 0.2 and Rich with 0.3. Ruin and Rich are absorbing.' },
      { kind: 'mistake', text: 'Calling any closed group of states “absorbing”. Two states that bounce between each other forever form a closed recurrent class, not an absorbing state.' },
      { kind: 'check', id: 'q1', question: 'Starting from Playing, what is the probability of eventually ending Rich?',
        choices: ['0.3', '0.5', '0.6'], correct: 2,
        explanation: 'Here Q = [0.5], so N = 1/(1 − 0.5) = 2 and Pr(Rich) = 2 × 0.3 = 0.6. The expected number of rounds is also 2.' },
    ],
    next: 'absorption.first-passage',
  },
  {
    id: 'absorption.first-passage', version: 1, level: 4, minutes: 12,
    title: 'Reaching a target versus being there',
    objective: 'Separate first arrival, occupancy at a step, and expected hitting time.',
    prerequisites: ['absorption.outcomes'],
    sections: [
      { kind: 'text', body: [
        'The hitting time T_A is the first step t ≥ 0 at which the chain is in the target set A. Pr(T_A ≤ t) asks “have we arrived by step t?”, while μₜ(A) asks “are we there at step t?”.',
        'If the target can be left after arrival, the two differ. And if the target might never be reached, the unconditional expected hitting time is infinite — even if most paths arrive quickly.',
      ] },
      { kind: 'demo-evolve', snapshot: ERRANDS, maxT: 12, caption: 'Target: Shop. The chain can arrive at Shop and then leave again.' },
      { kind: 'mistake', text: 'Reading μₜ(Shop) as the chance of having visited Shop by step t. It is lower, because some paths have already arrived and left.' },
      { kind: 'check', id: 'q1', question: 'Some paths can get stuck where the target is unreachable. What is the unconditional expected hitting time?',
        choices: ['The average over paths that arrive', 'Infinite', 'Undefined, so we report 0'], correct: 1,
        explanation: 'With positive probability T_A = ∞, so E[T_A] = ∞. The average among paths that arrive is a different, conditional quantity.' },
    ],
  },
];

export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));

/** Lesson links for validation issues and structural information (contextual learning). */
export const ISSUE_LESSONS: Record<string, string> = {
  'row.sum': 'foundations.rows',
  'row.zero': 'foundations.rows',
  'cell.out-of-range': 'foundations.rows',
  'initial.sum': 'evolution.one-step',
  'initial.invalid-entry': 'evolution.one-step',
  'info.reducible': 'longrun.classes',
  'info.multiple-closed': 'longrun.classes',
  'info.periodic': 'longrun.stationary',
  'info.unreachable': 'longrun.classes',
  'info.absorbing': 'absorption.outcomes',
};
