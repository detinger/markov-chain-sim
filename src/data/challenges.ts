// First four challenges (PLAN.md Module G). Grading is deterministic and uses exact model calculations.
import type { ChallengeDefinition, ModelSnapshot } from '../domain/assessment';

const st = (id: string, label: string, x: number, y: number) => ({ id, label, x, y });

const COMMUTE_BROKEN: ModelSnapshot = {
  title: 'Daily routine (broken)', stepLabel: 'hour',
  states: [st('home', 'Home', 0, 0), st('work', 'Work', 260, 0), st('gym', 'Gym', 130, 200)],
  P: [[0.3, 0.6, 0.3], [0.5, 0.2, 0], [0.4, -0.1, 0.7]],
  mu0: [0.5, 0, 0],
};

const TRAVEL: ModelSnapshot = {
  title: 'How I get to class', stepLabel: 'day',
  states: [st('bus', 'Bus', 0, 0), st('bike', 'Bike', 260, 0), st('car', 'Car', 130, 200)],
  P: [[0.5, 0.3, 0.2], [0.2, 0.6, 0.2], [0.3, 0.1, 0.6]],
  mu0: [0.5, 0.3, 0.2],
};

export const CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'repair-row', version: 1, level: 1, title: 'Repair a row',
    prerequisites: ['foundations.rows'],
    objective: 'Make every row and the starting distribution valid without removing the transitions the scenario requires.',
    scenario: [
      'This model of a daily routine was typed in a hurry. Some rows do not total 1, one entry is negative, and the starting distribution is incomplete.',
      'People really do sometimes go from Home to the Gym, and from Work back Home — keep those transitions possible.',
    ],
    mode: 'model', starter: COMMUTE_BROKEN, allowStructureEdits: false,
    assertions: [
      { kind: 'rows-valid' },
      { kind: 'initial-valid' },
      { kind: 'transition-positive', from: 'home', to: 'gym', why: 'The scenario says people sometimes go from Home to the Gym, so that probability must stay above 0.' },
      { kind: 'transition-positive', from: 'work', to: 'home', why: 'The scenario says people go from Work back Home, so that probability must stay above 0.' },
    ],
    hints: [
      'Open the Validate list below the matrix: it names every row that needs attention and the starting distribution.',
      'At every step the person must be somewhere, so the probabilities out of each state total exactly 1. A probability can never be negative.',
      'Choose a repair for each row: lower or raise one entry, use Normalize row (only once there are no negative entries), or change the negative Gym entry to 0. Start the day at Home with probability 1.',
    ],
    rubric: 'Each row of a transition matrix is a probability distribution over the next state.',
    reference: { snapshot: { ...COMMUTE_BROKEN, P: [[0.3, 0.5, 0.2], [0.6, 0.4, 0], [0.4, 0, 0.6]], mu0: [1, 0, 0] } },
    nextConcept: 'Next: use a valid model to compute where the chain is after one step (Evolution).',
  },
  {
    id: 'build-weather', version: 1, level: 1, title: 'Build a weather model',
    prerequisites: ['foundations.rows'],
    objective: 'Translate a written scenario into a two-state transition matrix.',
    scenario: [
      'If today is sunny, there is a 70% chance that tomorrow is sunny too.',
      'If today is rainy, there is a 40% chance that it rains again tomorrow.',
      'Create the states (name them as you like), fill in the matrix, then tell the checker which of your states means Sunny and which means Rainy.',
    ],
    mode: 'model', allowStructureEdits: true, roles: ['Sunny', 'Rainy'],
    starter: { title: 'My weather model', stepLabel: 'day', states: [], P: [], mu0: [] },
    assertions: [
      { kind: 'state-count', equals: 2 },
      { kind: 'rows-valid' },
      { kind: 'transition', from: 'Sunny', to: 'Sunny', value: 0.7, tolerance: 1e-9 },
      { kind: 'transition', from: 'Sunny', to: 'Rainy', value: 0.3, tolerance: 1e-9 },
      { kind: 'transition', from: 'Rainy', to: 'Rainy', value: 0.4, tolerance: 1e-9 },
      { kind: 'transition', from: 'Rainy', to: 'Sunny', value: 0.6, tolerance: 1e-9 },
    ],
    hints: [
      'Identify the states: the scenario only ever talks about two kinds of day.',
      'Rows are “today” (From) and columns are “tomorrow” (To). “If today is sunny, 70% sunny tomorrow” fills the Sunny row, Sunny column.',
      'Inspect one row: the Sunny row must total 1, so Sunny → Rainy is 1 − 0.7 = 0.3. Do the same for the Rainy row.',
    ],
    rubric: 'Each conditional sentence in a scenario fills one row: the condition is the From state.',
    reference: {
      snapshot: { title: 'ref', states: [st('w', 'Wet', 0, 0), st('c', 'Clear', 200, 0)], P: [[0.4, 0.6], [0.3, 0.7]], mu0: [0, 1] },
      roleMap: { Sunny: 'c', Rainy: 'w' },
    },
    nextConcept: 'Next: predict where your chain will be after several days (Evolution over many steps).',
  },
  {
    id: 'predict-path', version: 1, level: 2, title: 'Predict a path',
    prerequisites: ['evolution.paths'],
    objective: 'Compute a conditional and a joint path probability by hand.',
    scenario: [
      'This model describes how a student travels to class each day. On day 0, the student takes the bus with probability 0.5, the bike with 0.3, and the car with 0.2.',
      'Consider the path Bus → Bike → Bike (days 0, 1, 2).',
    ],
    mode: 'numeric', starter: TRAVEL, allowStructureEdits: false,
    assertions: [
      { kind: 'numeric-answer', key: 'conditional', label: 'Pr(Bike, Bike | start Bus)', target: { type: 'path', path: ['bus', 'bike', 'bike'], mode: 'conditional' }, tolerance: 1e-6 },
      { kind: 'numeric-answer', key: 'joint', label: 'Pr(Bus, Bike, Bike)', target: { type: 'path', path: ['bus', 'bike', 'bike'], mode: 'joint' }, tolerance: 1e-6 },
    ],
    hints: [
      'Count the transitions: three states means two steps, so two transition probabilities.',
      'Multiply the transitions: P(Bus → Bike) × P(Bike → Bike). That is the probability given the start.',
      'For the joint probability, also include the chance of starting on the bus: μ₀(Bus) × (your previous answer).',
    ],
    rubric: 'A path probability multiplies one factor per transition; the joint version adds the initial factor.',
    reference: { answers: { conditional: 0.18, joint: 0.09 } },
    nextConcept: 'Next: a single path is only one way to be somewhere — sum over all paths (Predict two steps).',
  },
  {
    id: 'predict-two-steps', version: 1, level: 2, title: 'Predict two steps',
    prerequisites: ['evolution.n-step'],
    objective: 'Compute one component of μ₂ by summing over the intermediate state.',
    scenario: [
      'Same travel model, but today (day 0) the student definitely takes the bus.',
      'What is the probability that the student drives (Car) on day 2?',
    ],
    mode: 'numeric', starter: { ...TRAVEL, mu0: [1, 0, 0] }, allowStructureEdits: false,
    assertions: [
      { kind: 'numeric-answer', key: 'mu2car', label: 'Pr(X₂ = Car | X₀ = Bus)', target: { type: 'distribution', t: 2, state: 'car' }, tolerance: 1e-6 },
    ],
    hints: [
      'Enumerate the intermediate state: on day 1 the student could be on the Bus, Bike, or in the Car.',
      'For each intermediate state k, multiply P(Bus → k) × P(k → Car).',
      'Add the three products: 0.5 × 0.2 + 0.3 × 0.2 + 0.2 × 0.6.',
    ],
    rubric: 'μₜ(j) is a sum over every path that ends in j at step t.',
    reference: { answers: { mu2car: 0.28 } },
    nextConcept: 'Next: what happens after many steps? (Long-run behavior)',
  },
];

export const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
