// Challenges (PLAN.md Module G) (PLAN.md Module G). Grading is deterministic and uses exact model calculations.
import { documentToSnapshot, type ChallengeDefinition, type ModelSnapshot } from '../domain/assessment';
import { exampleToDocument } from '../lib/examples';

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
  {
    id: 'compare-strategies', version: 1, level: 4, title: 'Compare strategies (Casino)',
    prerequisites: ['absorption.outcomes'],
    objective: 'Change only the “Feeling Lucky” strategy so that the chance of ending Rich from Playing Safe is at least 12%.',
    scenario: [
      'In the Casino model a player starts at “Playing Safe”. The baseline chance of eventually reaching “Walk Away Rich” is about 9%.',
      'The only thing the player controls is what they do when “Feeling Lucky”: retreat to Playing Safe or move up to the High Roller Room. The house rule fixes the chance of going broke from Feeling Lucky at 0.3.',
      'This is a toy model with invented numbers. Real casino games are designed so that the house wins on average; do not read it as advice.',
    ],
    mode: 'model', starter: { ...documentToSnapshot(exampleToDocument('gambler')), title: 'Casino (baseline)' },
    lockedRows: ['1', '2', '4', '5', '6'], allowStructureEdits: false,
    assertions: [
      { kind: 'rows-valid' },
      { kind: 'rows-locked' },
      { kind: 'transition-range', from: '3', to: '1', min: 0.3, max: 0.3, why: 'The house rule fixes P(Feeling Lucky → Broke & Busted) at 0.3; only the remaining 0.7 can be redistributed.' },
      { kind: 'metric', metric: { type: 'absorb', state: '6', label: 'Pr(end in Walk Away Rich)' }, op: 'at-least', value: 0.12,
        why: 'Compare the two exits from Feeling Lucky: from the High Roller Room the chance of ending Rich is about 38%, but from Playing Safe it is only about 9%, so retreating gives up most of the upside.' },
    ],
    hints: [
      'Read the baseline: open the Compare page (or Analysis) and note Pr(end Rich) ≈ 0.0905 from Playing Safe. Only the Feeling Lucky row may change, and its Broke entry must stay 0.3.',
      'Preserve the row constraint: whatever you add to “High Roller Room” must come out of “Playing Safe” (or another destination) so the row still totals 1.',
      'Compare the exact metric for a few splits of the remaining 0.7, e.g. 0.3/0.4 (baseline), 0.1/0.6, 0/0.7. Which destination has the higher chance of ending Rich?',
    ],
    rubric: 'In an absorbing chain, eventual outcomes follow from where each choice leads: route mass toward states with higher absorption probability into the goal. Because Broke and Rich are the only absorbing states, any gain in Pr(Rich) is an equal loss in Pr(Broke).',
    reference: { snapshot: (() => { const b = documentToSnapshot(exampleToDocument('gambler')); return { ...b, P: b.P.map((r, i) => (i === 2 ? [0.3, 0, 0, 0.7, 0, 0] : r)) }; })() },
    nextConcept: 'Next: a higher probability is not automatically “better” — try Escape the trap, where the metric and the goal can disagree.',
  },
  {
    id: 'escape-trap', version: 1, level: 4, title: 'Escape the trap (Doomscroll)',
    prerequisites: ['absorption.first-passage'],
    objective: 'Edit only the “Watching Reels” row so the expected number of steps from Open App to Close App is at most 12, while keeping autoplay at 0.5 or more.',
    scenario: [
      'In the Doomscroll model a session starts at “Open App” and ends at “Close App (Rage Quit)”. The baseline expected session length is about 14.75 steps.',
      'You redesign the reels feature, so only the Watching Reels row may change. Product insists that at least half of reels lead to another reel: P(Watching Reels → Watching Reels) ≥ 0.5.',
      'The numbers are invented for teaching. A shorter session is the goal here; ask yourself afterwards whether “shorter” is the right goal.',
    ],
    mode: 'model', starter: { ...documentToSnapshot(exampleToDocument('socialMedia')), title: 'Doomscroll (baseline)' },
    lockedRows: ['1', '2', '4', '5', '6', '7'], allowStructureEdits: false,
    assertions: [
      { kind: 'rows-valid' },
      { kind: 'rows-locked' },
      { kind: 'transition-range', from: '3', to: '3', min: 0.5, max: 1, why: 'The scenario requires autoplay: at least half of reels must lead to another reel.' },
      { kind: 'metric', metric: { type: 'mean-hit', targets: ['7'], label: 'Expected steps from Open App to Close App', unit: 'steps' }, op: 'at-most', value: 12,
        why: 'Where the freed-up probability goes matters: Mindless Scrolling loops back into reels, while Reading Comments (or a direct way out) leads toward closing the app sooner.' },
    ],
    hints: [
      'Identify the target: the session ends when the chain first reaches Close App. The metric is the expected hitting time E[T] from Open App (baseline ≈ 14.75 steps).',
      'Lowering the Reels self-loop alone is not enough — the probability you remove has to go somewhere, and destinations differ. Try sending it to Mindless Scrolling, then to Reading Comments, and compare.',
      'Keep Watching Reels → Watching Reels at 0.5 and compare a few allowed rows exactly, e.g. 0.5/0.5 to Mindless Scrolling versus 0.5/0.5 to Reading Comments, or add a small “take a break” transition to Close App.',
    ],
    rubric: 'Expected hitting times depend on the whole route to the target, not just one self-loop: moving probability toward states that lead out (here Reading Comments → Getting Triggered → Rage Quit, or a direct exit) shortens the expected time, while moving it into another loop lengthens it.',
    reference: { snapshot: (() => { const b = documentToSnapshot(exampleToDocument('socialMedia')); return { ...b, P: b.P.map((r, i) => (i === 2 ? [0, 0, 0.5, 0.5, 0, 0, 0] : r)) }; })() },
    nextConcept: 'Reflect: the comments route “wins” by getting people triggered. A metric only says what it measures — choosing the objective is part of the model. Try the same edit on the Compare page with an explicit goal.',
  },
];

export const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
