import { createEmptyDocument } from '../domain/markov/document';
import type { ChainDocumentV1 } from '../domain/markov/types';

// Original example data, preserved verbatim from the pre-upgrade app (PLAN.md B11).
interface LegacyNode { id: string; name: string; x: number; y: number }
interface LegacyEdge { id: string; source: string; target: string; probability: number }

export const EXAMPLES: Record<string, { name: string, nodes: LegacyNode[], edges: LegacyEdge[] }> = {
  weather: {
    name: 'Weather (Sunny/Rainy)',
    nodes: [
      { id: '1', name: 'Sunny', x: 100, y: 150 },
      { id: '2', name: 'Rainy', x: 400, y: 150 }
    ],
    edges: [
      { id: 'e1-1', source: '1', target: '1', probability: 0.8 },
      { id: 'e1-2', source: '1', target: '2', probability: 0.2 },
      { id: 'e2-1', source: '2', target: '1', probability: 0.4 },
      { id: 'e2-2', source: '2', target: '2', probability: 0.6 },
    ]
  },
  stockMarket: {
    name: 'Stock Market (Bull/Bear/Static)',
    nodes: [
      { id: '1', name: 'Bull Market', x: 250, y: 50 },
      { id: '2', name: 'Bear Market', x: 100, y: 300 },
      { id: '3', name: 'Stagnant', x: 400, y: 300 }
    ],
    edges: [
      { id: 'e1-1', source: '1', target: '1', probability: 0.9 },
      { id: 'e1-2', source: '1', target: '2', probability: 0.05 },
      { id: 'e1-3', source: '1', target: '3', probability: 0.05 },
      { id: 'e2-1', source: '2', target: '1', probability: 0.15 },
      { id: 'e2-2', source: '2', target: '2', probability: 0.8 },
      { id: 'e2-3', source: '2', target: '3', probability: 0.05 },
      { id: 'e3-1', source: '3', target: '1', probability: 0.25 },
      { id: 'e3-2', source: '3', target: '2', probability: 0.25 },
      { id: 'e3-3', source: '3', target: '3', probability: 0.5 },
    ]
  },
  pagerank: {
    name: 'Mini PageRank',
    nodes: [
      { id: '1', name: 'Page A', x: 250, y: 50 },
      { id: '2', name: 'Page B', x: 100, y: 200 },
      { id: '3', name: 'Page C', x: 400, y: 200 },
      { id: '4', name: 'Page D', x: 250, y: 350 }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2', probability: 0.5 },
      { id: 'e1-3', source: '1', target: '3', probability: 0.5 },
      { id: 'e2-1', source: '2', target: '1', probability: 1.0 },
      { id: 'e3-2', source: '3', target: '2', probability: 0.33 },
      { id: 'e3-4', source: '3', target: '4', probability: 0.67 },
      { id: 'e4-1', source: '4', target: '1', probability: 0.5 },
      { id: 'e4-3', source: '4', target: '3', probability: 0.5 },
    ]
  },
  epidemic: {
    name: 'Epidemic Model (SIR)',
    nodes: [
      { id: '1', name: 'Susceptible', x: 100, y: 100 },
      { id: '2', name: 'Infected', x: 400, y: 100 },
      { id: '3', name: 'Recovered', x: 250, y: 300 }
    ],
    edges: [
      { id: 'e1-1', source: '1', target: '1', probability: 0.95 },
      { id: 'e1-2', source: '1', target: '2', probability: 0.05 },
      { id: 'e2-2', source: '2', target: '2', probability: 0.8 },
      { id: 'e2-3', source: '2', target: '3', probability: 0.2 },
      { id: 'e3-3', source: '3', target: '3', probability: 1.0 },
    ]
  },
  gambler: {
    name: 'Casino Heist (Risk vs Reward)',
    nodes: [
      { id: '1', name: 'Broke & Busted', x: 50, y: 250 },
      { id: '2', name: 'Playing Safe', x: 250, y: 100 },
      { id: '3', name: 'Feeling Lucky', x: 450, y: 100 },
      { id: '4', name: 'High Roller Room', x: 250, y: 400 },
      { id: '5', name: 'VIP Status', x: 450, y: 400 },
      { id: '6', name: 'Walk Away Rich', x: 650, y: 250 }
    ],
    edges: [
      { id: 'e1-1', source: '1', target: '1', probability: 1.0 },
      { id: 'e2-1', source: '2', target: '1', probability: 0.2 },
      { id: 'e2-2', source: '2', target: '2', probability: 0.6 },
      { id: 'e2-3', source: '2', target: '3', probability: 0.2 },
      { id: 'e3-1', source: '3', target: '1', probability: 0.3 },
      { id: 'e3-2', source: '3', target: '2', probability: 0.3 },
      { id: 'e3-4', source: '3', target: '4', probability: 0.4 },
      { id: 'e4-1', source: '4', target: '1', probability: 0.5 },
      { id: 'e4-5', source: '4', target: '5', probability: 0.5 },
      { id: 'e5-4', source: '5', target: '4', probability: 0.3 },
      { id: 'e5-5', source: '5', target: '5', probability: 0.2 },
      { id: 'e5-6', source: '5', target: '6', probability: 0.5 },
      { id: 'e6-6', source: '6', target: '6', probability: 1.0 },
    ]
  },
  socialMedia: {
    name: 'The Doomscroll Trap',
    nodes: [
      { id: '1', name: 'Open App', x: 100, y: 150 },
      { id: '2', name: 'Mindless Scrolling', x: 250, y: 150 },
      { id: '3', name: 'Watching Reels', x: 450, y: 50 },
      { id: '4', name: 'Reading Comments', x: 450, y: 250 },
      { id: '5', name: 'Writing Comment', x: 700, y: 250 },
      { id: '6', name: 'Getting Triggered', x: 450, y: 400 },
      { id: '7', name: 'Close App (Rage Quit)', x: 150, y: 350 }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2', probability: 1.0 },
      { id: 'e2-2', source: '2', target: '2', probability: 0.6 },
      { id: 'e2-3', source: '2', target: '3', probability: 0.3 },
      { id: 'e2-7', source: '2', target: '7', probability: 0.1 },
      { id: 'e3-3', source: '3', target: '3', probability: 0.7 },
      { id: 'e3-4', source: '3', target: '4', probability: 0.2 },
      { id: 'e3-2', source: '3', target: '2', probability: 0.1 },
      { id: 'e4-4', source: '4', target: '4', probability: 0.4 },
      { id: 'e4-5', source: '4', target: '5', probability: 0.1 },
      { id: 'e4-6', source: '4', target: '6', probability: 0.3 },
      { id: 'e4-2', source: '4', target: '2', probability: 0.2 },
      { id: 'e5-4', source: '5', target: '4', probability: 0.6 },
      { id: 'e5-2', source: '5', target: '2', probability: 0.4 },
      { id: 'e6-6', source: '6', target: '6', probability: 0.3 },
      { id: 'e6-4', source: '6', target: '4', probability: 0.2 },
      { id: 'e6-7', source: '6', target: '7', probability: 0.5 },
      { id: 'e7-7', source: '7', target: '7', probability: 1.0 },
    ]
  }
};

// Small teaching examples (PLAN.md §6, Phase 6). Same shape as the originals; the originals above stay untouched.
export const TEACHING_EXAMPLES: typeof EXAMPLES = {
  alternator: {
    name: 'Deterministic alternator',
    nodes: [{ id: 'a', name: 'A', x: 100, y: 150 }, { id: 'b', name: 'B', x: 400, y: 150 }],
    edges: [{ id: 'ab', source: 'a', target: 'b', probability: 1 }, { id: 'ba', source: 'b', target: 'a', probability: 1 }],
  },
  twoOutcomes: {
    name: 'Two absorbing outcomes',
    nodes: [{ id: 'play', name: 'Playing', x: 250, y: 80 }, { id: 'win', name: 'Win', x: 450, y: 280 }, { id: 'lose', name: 'Lose', x: 50, y: 280 }],
    edges: [
      { id: 'pp', source: 'play', target: 'play', probability: 0.5 },
      { id: 'pw', source: 'play', target: 'win', probability: 0.3 },
      { id: 'pl', source: 'play', target: 'lose', probability: 0.2 },
      { id: 'ww', source: 'win', target: 'win', probability: 1 },
      { id: 'll', source: 'lose', target: 'lose', probability: 1 },
    ],
  },
  reducible: {
    name: 'Reducible classes',
    nodes: [{ id: 'a', name: 'A', x: 50, y: 150 }, { id: 'b', name: 'B', x: 250, y: 50 }, { id: 'c', name: 'C', x: 450, y: 150 }, { id: 'd', name: 'D', x: 250, y: 300 }],
    edges: [
      { id: 'aa', source: 'a', target: 'a', probability: 0.5 },
      { id: 'ab', source: 'a', target: 'b', probability: 0.5 },
      { id: 'bc', source: 'b', target: 'c', probability: 1 },
      { id: 'cb', source: 'c', target: 'b', probability: 1 },
      { id: 'dd', source: 'd', target: 'd', probability: 1 },
    ],
  },
  stickyRare: {
    name: 'Sticky state, rare exit',
    nodes: [{ id: 'stuck', name: 'Stuck', x: 100, y: 150 }, { id: 'free', name: 'Free', x: 400, y: 150 }],
    edges: [
      { id: 'ss', source: 'stuck', target: 'stuck', probability: 0.99 },
      { id: 'sf', source: 'stuck', target: 'free', probability: 0.01 },
      { id: 'ff', source: 'free', target: 'free', probability: 1 },
    ],
  },
  unreachableTarget: {
    name: 'Unreachable target',
    nodes: [{ id: 'home', name: 'Home', x: 80, y: 150 }, { id: 'park', name: 'Park', x: 320, y: 150 }, { id: 'island', name: 'Island', x: 560, y: 150 }],
    edges: [
      { id: 'hh', source: 'home', target: 'home', probability: 0.4 },
      { id: 'hp', source: 'home', target: 'park', probability: 0.6 },
      { id: 'ph', source: 'park', target: 'home', probability: 0.7 },
      { id: 'pp', source: 'park', target: 'park', probability: 0.3 },
      { id: 'ii', source: 'island', target: 'island', probability: 1 },
    ],
  },
  oneState: {
    name: 'One-state chain',
    nodes: [{ id: 'only', name: 'Only state', x: 200, y: 150 }],
    edges: [{ id: 'oo', source: 'only', target: 'only', probability: 1 }],
  },
};

/** Every example the app can open: originals first, then the small teaching examples. */
export const ALL_EXAMPLES: typeof EXAMPLES = { ...EXAMPLES, ...TEACHING_EXAMPLES };

export interface ExampleMeta {
  subtitle?: string;
  description: string;
  stepLabel?: string;
  difficulty: 'Intro' | 'Intermediate' | 'Advanced';
  /** Related lesson for annotated examples. */
  lesson?: string;
  /** Starting state for μ₀. Defaults to the first state (the pre-upgrade chart behavior). */
  start?: string;
  assumptions: string[];
  /** What the example is meant to teach. */
  goals?: string[];
  /** Original data from the pre-upgrade app, or a small teaching example added in Phase 6. */
  group?: 'original' | 'teaching';
}

export const EXAMPLE_META: Record<string, ExampleMeta> = {
  weather: {
    lesson: 'foundations.rows',
    description: 'Two weather states. Each row says what tomorrow looks like given today.',
    stepLabel: 'day',
    difficulty: 'Intro',
    assumptions: ['Tomorrow depends only on today, not on earlier days.', 'Illustrative probabilities, not a forecast.'],
  },
  stockMarket: {
    lesson: 'longrun.stationary',
    description: 'Three market regimes with persistent bull and bear phases.',
    stepLabel: 'week',
    difficulty: 'Intro',
    assumptions: ['Illustrative regime probabilities, not financial data or advice.'],
  },
  pagerank: {
    lesson: 'longrun.stationary',
    description: 'A random surfer follows links between four pages; the stationary vector ranks them.',
    difficulty: 'Intermediate',
    assumptions: ['No damping/teleport term, unlike production PageRank.'],
  },
  epidemic: {
    lesson: 'absorption.outcomes',
    subtitle: 'Simplified individual-status Markov model',
    description: 'One person moves from Susceptible to Infected to Recovered with fixed per-step probabilities.',
    stepLabel: 'day',
    difficulty: 'Intro',
    assumptions: [
      'Models a single individual, not population counts.',
      'Infection probability is fixed; a real SIR epidemic depends on how many people are currently infected, so this chain cannot show an outbreak peaking and fading.',
      'Waiting times are geometric (memoryless): on average 20 days until infection and 5 days infected.',
      'Recovered is absorbing (permanent immunity).',
    ],
    goals: ['Absorption and expected time to absorption', 'Recognizing what a fixed-rate chain leaves out'],
  },
  gambler: {
    lesson: 'absorption.outcomes',
    description: 'A risk/reward story with two absorbing outcomes: Broke & Busted (ruin) and Walk Away Rich.',
    stepLabel: 'round',
    difficulty: 'Intermediate',
    // The first listed state is the absorbing "Broke & Busted"; starting there makes every chart flat.
    start: '2',
    assumptions: [
      'Educational probabilities, not real gambling odds or advice. Real casino games are designed so that players lose on average.',
      'States are situations, not amounts of money; there is no bankroll in the model.',
    ],
    goals: ['Two absorbing outcomes: ruin versus riches', 'Comparing strategies on exact absorption probabilities'],
  },
  socialMedia: {
    lesson: 'absorption.first-passage',
    description: 'Seven engagement states; closing the app is the only absorbing exit.',
    stepLabel: 'minute',
    difficulty: 'Advanced',
    assumptions: [
      'Invented probabilities for teaching, not measured from real users.',
      '“Getting Triggered” and “Rage Quit” are story labels, not psychological diagnoses.',
      'One step is a fixed slice of time; closing the app ends this model (returning later is not modeled).',
    ],
    goals: ['Expected time to reach an absorbing exit', 'How one edit changes a hitting time — and whether the metric is the right goal'],
  },
  alternator: {
    group: 'teaching', lesson: 'longrun.stationary', difficulty: 'Intro',
    description: 'A always goes to B and B always goes to A.',
    goals: ['Period 2: π = [0.5, 0.5] is stationary but μₜ from A never converges'],
    assumptions: ['Deterministic transitions are still a valid Markov chain.'],
  },
  twoOutcomes: {
    group: 'teaching', lesson: 'absorption.outcomes', difficulty: 'Intro', stepLabel: 'round',
    description: 'Each round: keep playing (0.5), Win (0.3) or Lose (0.2).',
    goals: ['Pr(Win) = 0.3 / 0.5 = 0.6 and 2 expected rounds, by hand'],
    assumptions: ['Win and Lose are absorbing.'],
  },
  reducible: {
    group: 'teaching', lesson: 'longrun.classes', difficulty: 'Intermediate',
    description: 'A transient state, a closed periodic pair, and a closed state that the start never reaches.',
    goals: ['Communicating classes, closed versus transient, and an unreachable class'],
    assumptions: ['D is valid even though it is never visited from A.'],
  },
  stickyRare: {
    group: 'teaching', lesson: 'experiments.censoring', difficulty: 'Intermediate',
    description: 'Leaving “Stuck” has probability 0.01 per step, so the expected wait is 100 steps.',
    goals: ['Rare transitions mean long expected times', 'Short simulation horizons censor most paths'],
    assumptions: ['Free is absorbing.'],
  },
  unreachableTarget: {
    group: 'teaching', lesson: 'absorption.first-passage', difficulty: 'Intermediate',
    description: 'Home and Park visit each other; Island is never reached from them.',
    goals: ['Hitting probability 0 and an infinite expected hitting time for Island'],
    assumptions: ['An unreachable state is allowed; it is not a modeling error.'],
  },
  oneState: {
    group: 'teaching', lesson: 'foundations.rows', difficulty: 'Intro',
    description: 'The smallest valid chain: one state that always stays.',
    goals: ['A row with a single entry of 1; π = [1]'],
    assumptions: ['Trivial, but a useful edge case.'],
  },
};

/** Convert an original example into a canonical document (data unchanged; μ₀ is a point mass at the start state). */
export function exampleToDocument(key: string): ChainDocumentV1 {
  const ex = ALL_EXAMPLES[key];
  const meta = EXAMPLE_META[key];
  const doc = createEmptyDocument(ex.name);
  const ids = ex.nodes.map((n) => n.id);
  const start = meta?.start ?? ids[0];
  return {
    ...doc,
    stateOrder: ids,
    states: ex.nodes.map((n) => ({ id: n.id, label: n.name })),
    transitions: ex.edges.map((e) => ({ from: e.source, to: e.target, probability: e.probability })),
    initial: ids.map((id) => ({ stateId: id, probability: id === start ? 1 : 0 })),
    layout: { positions: Object.fromEntries(ex.nodes.map((n) => [n.id, { x: n.x, y: n.y }])) },
    metadata: {
      ...doc.metadata,
      description: [meta?.subtitle, meta?.description].filter(Boolean).join(' — ') || undefined,
      stepLabel: meta?.stepLabel,
      exampleId: key,
      exampleVersion: 1,
    },
  };
}
