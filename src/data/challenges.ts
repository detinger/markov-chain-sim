// Challenges (PLAN.md Module G) (PLAN.md Module G). Grading is deterministic and uses exact model calculations.
import { documentToSnapshot, type ChallengeDefinition, type ModelSnapshot } from '../domain/assessment';
import { exampleToDocument } from '../lib/examples';
import { ALTERNATOR, ERRANDS, WEATHER } from './lessons';

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


const CLASSES: ModelSnapshot = {
  title: 'Who ends up where?',
  states: [st('a', 'A', 0, 100), st('b', 'B', 180, 0), st('c', 'C', 180, 200), st('d', 'D', 380, 100), st('e', 'E', 560, 100),
    st('h', 'H', 0, 330), st('f', 'F', 280, 330), st('g', 'G', 500, 330)],
  //        A    B    C    D    E    H    F    G
  P: [[0, 0.6, 0, 0.4, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0, 0, 0],
    [0.3, 0.7, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0.5, 0.5, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0.4, 0.6],
    [0, 0, 0, 0, 0, 0, 1, 0]],
  mu0: [1, 0, 0, 0, 0, 0, 0, 0],
};

const HIGH_LOW: ModelSnapshot = {
  title: 'Two-table casino', stepLabel: 'round',
  states: [st('low', 'Low table', 0, 0), st('high', 'High table', 260, 0), st('ruin', 'Ruin', 0, 200), st('rich', 'Rich', 260, 200)],
  P: [[0, 0.6, 0.4, 0], [0.5, 0, 0, 0.5], [0, 0, 1, 0], [0, 0, 0, 1]],
  mu0: [1, 0, 0, 0],
};

const SIR = { ...documentToSnapshot(exampleToDocument('epidemic')), title: 'SIR (individual status)' };

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
    id: 'stationary-not-convergence', version: 1, level: 3, title: 'Stationary is not convergence',
    prerequisites: ['longrun.stationary'],
    objective: 'Find π for the deterministic alternator and explain why μₜ does not converge to it.',
    scenario: [
      'A light switch alternates every step: A always goes to B and B always goes to A. The chain starts in A.',
      'Answer the questions using exact reasoning; you can check them in the Analysis page or the step slider.',
    ],
    mode: 'numeric', starter: ALTERNATOR, allowStructureEdits: false,
    assertions: [
      { kind: 'numeric-answer', key: 'piA', label: 'π(A) for the stationary distribution', target: { type: 'stationary', state: 'a' }, tolerance: 1e-6 },
      { kind: 'numeric-answer', key: 'mu101', label: 'μ₁₀₁(A), starting from A', target: { type: 'distribution', t: 101, state: 'a' }, tolerance: 1e-9 },
      { kind: 'choice-answer', key: 'converge', label: 'Does μₜ converge?', question: 'Starting from A, does μₜ converge as t grows?',
        choices: ['Yes, to π = [0.5, 0.5]', 'No — it alternates forever; π is the long-run average, not a limit', 'No, because the chain has no stationary distribution'], correct: 1,
        explanations: ['μₜ is [1, 0] at even steps and [0, 1] at odd steps, so it never settles. Only the average over time approaches π.', 'Correct: the chain has period 2. π satisfies πP = π, but convergence also needs aperiodicity.', 'π = [0.5, 0.5] does satisfy πP = π, so a stationary distribution exists.'] },
      { kind: 'choice-answer', key: 'start', label: 'Which start keeps μₜ constant?', question: 'Which starting distribution makes μₜ the same at every step?',
        choices: ['Start in A', 'Start 50% in A and 50% in B', 'No starting distribution does'], correct: 1,
        explanations: ['From A the distribution flips every step.', 'Correct: starting in π keeps the distribution at π forever — that is what “stationary” means.', 'Starting in π = [0.5, 0.5] keeps it constant.'] },
    ],
    hints: [
      'Solve πP = π: with P = [[0, 1], [1, 0]], π(A) = π(B), and π(A) + π(B) = 1.',
      'Inspect the period: from A you can only return at even steps. So at an odd step t the chain is certainly in B.',
      'Compare different starts: what happens to μₜ if you start in π itself?',
    ],
    rubric: 'A stationary distribution is a fixed point of μ ↦ μP. Reaching it from an arbitrary start additionally needs aperiodicity; a period-2 chain oscillates forever.',
    reference: { answers: { piA: 0.5, mu101: 0, converge: '1', start: '1' } },
    nextConcept: 'Next: when there are several closed classes, where the chain ends up depends on where it starts (Find closed classes).',
  },
  {
    id: 'find-closed-classes', version: 1, level: 3, title: 'Find closed classes',
    prerequisites: ['longrun.classes'],
    objective: 'Classify every state as closed (recurrent) or transient, including a part of the graph the chain never visits.',
    scenario: [
      'Follow only transitions with positive probability. A class is closed when no transition leaves it.',
      'The chain starts in A. Some states cannot be reached from A — classify them anyway: being unreachable does not change what kind of state they are.',
    ],
    mode: 'numeric', starter: CLASSES, allowStructureEdits: false,
    assertions: [
      { kind: 'state-set', key: 'closed', label: 'States in closed classes', target: 'closed', why: 'A state is in a closed class when every state it can reach can also reach it back. Check each class for an exit.' },
      { kind: 'state-set', key: 'transient', label: 'Transient states', target: 'transient', why: 'A state is transient when it can reach a state that never leads back to it. A, B and C form a class, but it has an exit to D.' },
      { kind: 'choice-answer', key: 'fate', label: 'Where does the chain end up from A?', question: 'Starting from A, in which closed class does the chain eventually stay?',
        choices: ['{D, E} with probability 1', '{F, G} or {D, E}, depending on luck', 'It keeps cycling through A, B, C'], correct: 0,
        explanations: ['Correct: {A, B, C} leaks into D and nothing leads back; {F, G} is closed but unreachable from A.', '{F, G} cannot be reached from A, so it gets probability 0.', 'The cycle A → B → C → A is possible, but every visit to A has a 0.4 chance of leaving to D for good.'] },
    ],
    hints: [
      'Follow positive edges: list, for each state, the states it can reach in one step.',
      'Find the strongly connected groups (states that can reach each other): {A, B, C}, {D, E}, {F, G} and {H}.',
      'Inspect exits: a group with an edge to another group is transient; a group with no exits is closed — even if the start never reaches it.',
    ],
    rubric: 'Classes come from mutual reachability; closedness from the absence of exits. Reachability from the start decides which closed class can matter, not whether a class is closed.',
    reference: { answers: { closed: 'd,e,f,g', transient: 'a,b,c,h', fate: '0' } },
    nextConcept: 'Next: when the closed classes are single absorbing states, compute where the chain ends up (Casino outcomes).',
  },
  {
    id: 'casino-outcomes', version: 1, level: 4, title: 'Casino outcomes',
    prerequisites: ['absorption.outcomes'],
    objective: 'Compute the probability of ending Rich and the expected number of rounds, starting at the Low table.',
    scenario: [
      'A player at the Low table goes broke (Ruin) with probability 0.4 or moves up to the High table with probability 0.6. At the High table they win (Rich) with probability 0.5 or drop back to the Low table with probability 0.5.',
      'Ruin and Rich are absorbing. Fractions such as 3/7 are accepted. This is a toy model, not gambling advice.',
    ],
    mode: 'numeric', starter: HIGH_LOW, allowStructureEdits: false,
    assertions: [
      { kind: 'numeric-answer', key: 'rich', label: 'Pr(end Rich | start Low)', target: { type: 'absorb', from: 'low', into: 'rich' }, tolerance: 1e-4 },
      { kind: 'numeric-answer', key: 'ruin', label: 'Pr(end Ruin | start Low)', target: { type: 'absorb', from: 'low', into: 'ruin' }, tolerance: 1e-4 },
      { kind: 'numeric-answer', key: 'steps', label: 'Expected rounds until absorption from Low', target: { type: 'expected-steps', from: 'low' }, tolerance: 1e-4 },
    ],
    hints: [
      'Identify the transient block: Low and High are transient; Ruin and Rich are absorbing.',
      'Set up one equation per transient state. For Rich: h(Low) = 0.6·h(High), h(High) = 0.5·h(Low) + 0.5. For time: t(Low) = 1 + 0.6·t(High), t(High) = 1 + 0.5·t(Low).',
      'Substitute and solve: h(Low) = 0.3·h(Low) + 0.3, and t(Low) = 1.6 + 0.3·t(Low). Interpret: the two outcome probabilities must add to 1.',
    ],
    rubric: 'Absorption probabilities and times solve linear equations over the transient states (B = (I − Q)⁻¹R, t = (I − Q)⁻¹1); one-step probabilities ignore paths that loop before absorbing.',
    reference: { answers: { rich: 3 / 7, ruin: 4 / 7, steps: 16 / 7 } },
    nextConcept: 'Next: being in a state is not the same as having reached it (First hit versus occupancy).',
  },
  {
    id: 'first-hit-vs-occupancy', version: 1, level: 4, title: 'First hit versus occupancy',
    prerequisites: ['absorption.first-passage'],
    objective: 'Compute the probability of having reached the Shop by step 2 and of being at the Shop at step 2, and explain the difference.',
    scenario: [
      'Errands model: from Home you stay Home (0.5) or go to the Shop (0.5). From the Shop you go Home (0.3), stay (0.2) or go to the Café (0.5). From the Café you go Home (0.4) or stay (0.6).',
      'You start at Home (step 0). The Shop can be left after arriving.',
    ],
    mode: 'numeric', starter: ERRANDS, allowStructureEdits: false,
    assertions: [
      { kind: 'numeric-answer', key: 'hit', label: 'Pr(reached Shop by step 2)', target: { type: 'hit-by', targets: ['shop'], t: 2 }, tolerance: 1e-6 },
      { kind: 'numeric-answer', key: 'occ', label: 'Pr(at the Shop at step 2) = μ₂(Shop)', target: { type: 'distribution', t: 2, state: 'shop' }, tolerance: 1e-6 },
      { kind: 'choice-answer', key: 'why', label: 'Why do they differ?', question: 'Why is the first probability larger than the second?',
        choices: ['Because some paths arrive at the Shop at step 1 and leave by step 2', 'Because μ₂ ignores the starting state', 'They should be equal; one of them is a rounding error'], correct: 0,
        explanations: ['Correct: Home → Shop → Home and Home → Shop → Café have arrived but are not at the Shop at step 2.', 'μ₂ does depend on the start; both quantities start from Home.', 'They are different events: “has arrived by step 2” versus “is there at step 2”.'] },
    ],
    hints: [
      'Trace early hits: which two-step paths from Home visit the Shop at step 1 or step 2?',
      'Inspect later departures: of the paths at the Shop at step 1, which ones are no longer there at step 2?',
      'Distinguish the events: Pr(hit by 2) = 0.5 + 0.5 × 0.5. μ₂(Shop) adds Home→Home→Shop and Home→Shop→Shop.',
    ],
    rubric: 'First arrival counts a path once it reaches the target, even if it leaves again; occupancy μₜ(A) only counts paths that are in A at step t. They coincide only for targets that cannot be left.',
    reference: { answers: { hit: 0.75, occ: 0.35, why: '0' } },
    nextConcept: 'Next: models leave things out — Diagnose the SIR abstraction.',
  },
  {
    id: 'diagnose-sir', version: 1, level: 4, title: 'Diagnose the SIR abstraction',
    prerequisites: ['absorption.outcomes'],
    objective: 'Explain what the three-state SIR example can and cannot represent.',
    scenario: [
      'The SIR example is a fixed three-state chain: Susceptible → Infected with probability 0.05 per day, Infected → Recovered with probability 0.2 per day, and Recovered is absorbing.',
      'Epidemiological SIR models describe a whole population, where new infections depend on how many people are currently infected. Decide what this simpler chain describes.',
    ],
    mode: 'numeric', starter: SIR, allowStructureEdits: false,
    assertions: [
      { kind: 'choice-answer', key: 'unit', label: 'What one state describes', question: 'What does a single state of this chain describe?',
        choices: ['How many people are infected', 'The health status of one person', 'The share of the population in each group'], correct: 1,
        explanations: ['Counts would need many states (one per possible number of infected people).', 'Correct: the chain tracks one individual moving between S, I and R.', 'Shares are what μₜ can be read as for many independent people — but not for an interacting population.'] },
      { kind: 'choice-answer', key: 'rate', label: 'Fixed infection probability', question: 'Does a susceptible person’s chance of infection tomorrow depend on how many people are infected today?',
        choices: ['Yes, it rises when more people are infected', 'No, it is fixed at 0.05 per day'], correct: 1,
        explanations: ['Not in this chain: P(S → I) is a constant. Population feedback is exactly what it leaves out.', 'Correct: transition probabilities are fixed, so there is no feedback from prevalence.'] },
      { kind: 'numeric-answer', key: 'days', label: 'Expected days from Infected to Recovered', target: { type: 'expected-steps', from: '2' }, tolerance: 1e-6 },
      { kind: 'choice-answer', key: 'limit', label: 'What the chain cannot show', question: 'Which real-world pattern can this chain NOT produce?',
        choices: ['An outbreak that peaks and then fades because fewer susceptible people are left', 'A person staying infected for several days', 'A recovered person never being reinfected'], correct: 0,
        explanations: ['Correct: a peak needs the infection rate to depend on the current numbers of infected and susceptible people.', 'It can: Infected → Infected has probability 0.8, so infections last 5 days on average (geometrically distributed).', 'It does: Recovered is absorbing.'] },
    ],
    hints: [
      'Identify the unit: is a state a number of people or a condition of one person?',
      'Inspect the fixed rates: is any transition probability a function of the current distribution?',
      'Distinguish population feedback: in a population SIR model, new infections ∝ (infected) × (susceptible). Which pattern requires that?',
    ],
    rubric: 'A fixed-probability chain over S, I, R models one individual with constant rates; it cannot show prevalence-dependent effects such as epidemic peaks. Durations under it are geometric (memoryless).',
    reference: { answers: { unit: '1', rate: '1', days: 5, limit: '0' } },
    nextConcept: 'Next: estimate quantities by simulation and judge their precision (Interpret uncertainty).',
  },
  {
    id: 'interpret-uncertainty', version: 1, level: 5, title: 'Interpret uncertainty',
    prerequisites: ['experiments.estimates'],
    objective: 'Compare a small and a large Monte Carlo experiment with the exact value and explain the difference in precision.',
    scenario: [
      'Two experiments estimate μ₁₀(Rainy) for the weather model starting Sunny: one with 50 independent replications and one with 5,000. Both use fixed seeds, so you will always see the same numbers.',
      'The exact value is shown beside them. Use the 95% Wilson intervals to answer.',
    ],
    mode: 'numeric', starter: WEATHER, allowStructureEdits: false,
    experiment: { horizon: 10, state: 'rain', runs: [{ label: 'Small', replications: 50, seed: 7 }, { label: 'Large', replications: 5000, seed: 7 }] },
    assertions: [
      { kind: 'numeric-answer', key: 'exact', label: 'Exact μ₁₀(Rainy) (4 decimals)', target: { type: 'distribution', t: 10, state: 'rain' }, tolerance: 1e-4 },
      { kind: 'choice-answer', key: 'width', label: 'Which interval is narrower', question: 'Which experiment has the narrower 95% interval, and roughly by how much?',
        choices: ['Small — fewer runs, less noise', 'Large — about 10 times narrower, because width shrinks like 1/√M', 'Large — about 100 times narrower, because it has 100 times the runs'], correct: 1,
        explanations: ['Fewer replications means more sampling noise and a wider interval.', 'Correct: 100× the replications gives about √100 = 10× the precision.', 'Width scales with 1/√M, not 1/M: 100× the runs gives about 10× narrower.'] },
      { kind: 'choice-answer', key: 'miss', label: 'Explaining a gap from the exact value', question: 'Suppose a 50-replication estimate is several percentage points away from the exact value. What is the best explanation?',
        choices: ['The model must be wrong', 'Sampling variation: 50 independent runs give an imprecise estimate', 'The random number generator is broken'], correct: 1,
        explanations: ['The exact value comes from the same model, so a disagreement cannot show the model is wrong.', 'Correct: with M = 50 a 95% interval is typically ±10–13 percentage points wide around the estimate.', 'The generator is tested and reproducible; small samples simply vary.'] },
      { kind: 'choice-answer', key: 'seed', label: 'Changing the seed', question: 'What happens if you rerun the small experiment with a different seed?',
        choices: ['Exactly the same estimate', 'A different estimate; its interval will usually (about 95% of the time) still contain the exact value', 'The exact value changes too'], correct: 1,
        explanations: ['A different seed gives different random draws, so different paths.', 'Correct: each seed is one realization of the sampling variation; the coverage statement is about many such repetitions.', 'The exact value depends only on the model, not on the seed.'] },
    ],
    hints: [
      'Check the counts: how many replications does each estimate use?',
      'Inspect each interval: compare its width with the other one, and check whether it contains the exact value.',
      'Explain sampling variation: an estimate from M independent runs has standard error about √(p(1 − p)/M).',
    ],
    rubric: 'Monte Carlo estimates vary from run to run; their precision grows like √M. Intervals express that uncertainty; disagreement with an exact value within that uncertainty is not evidence of a wrong model.',
    reference: { answers: { exact: 0.3333, width: '1', miss: '1', seed: '1' } },
    nextConcept: 'Next: compare two scenarios on exact metrics (Compare strategies).',
  },
  {
    id: 'compare-strategies', version: 1, level: 5, title: 'Compare strategies (Casino)',
    prerequisites: ['experiments.comparing'],
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
    id: 'escape-trap', version: 1, level: 5, title: 'Escape the trap (Doomscroll)',
    prerequisites: ['experiments.comparing'],
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
