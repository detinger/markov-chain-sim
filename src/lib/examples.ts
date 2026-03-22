import { MarkovNode, MarkovEdge } from '../hooks/useMarkovModel';

export const EXAMPLES: Record<string, { name: string, nodes: MarkovNode[], edges: MarkovEdge[] }> = {
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
