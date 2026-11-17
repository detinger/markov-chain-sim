import type { AnalysisOutcome, CompiledChain } from './types';

export interface CommunicatingClass {
  /** Indices into the chain's state order, ascending. */
  states: number[];
  /** No positive-probability edge leaves the class. Closed classes are recurrent in a finite chain. */
  closed: boolean;
  /** gcd of cycle lengths inside the class; null for an acyclic singleton (not applicable). */
  period: number | null;
}

export interface StructureResult {
  classes: CommunicatingClass[];
  classOf: number[];
  /** States with P[i][i] = 1. */
  absorbing: number[];
  transient: number[];
  irreducible: boolean;
  reachableFromInitial: boolean[];
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export function supportGraph(P: readonly (readonly number[])[]): number[][] {
  return P.map((row) => row.flatMap((p, j) => (p > 0 ? [j] : [])));
}

/** Tarjan's strongly connected components (iterative). */
export function stronglyConnectedComponents(adj: number[][]): number[][] {
  const n = adj.length;
  const index = new Array(n).fill(-1);
  const low = new Array(n).fill(0);
  const onStack = new Array(n).fill(false);
  const stack: number[] = [];
  const result: number[][] = [];
  let counter = 0;

  for (let root = 0; root < n; root++) {
    if (index[root] !== -1) continue;
    const work: [number, number][] = [[root, 0]];
    while (work.length) {
      const frame = work[work.length - 1];
      const [v, i] = frame;
      if (i === 0) {
        index[v] = low[v] = counter++;
        stack.push(v);
        onStack[v] = true;
      }
      if (i < adj[v].length) {
        frame[1]++;
        const w = adj[v][i];
        if (index[w] === -1) work.push([w, 0]);
        else if (onStack[w]) low[v] = Math.min(low[v], index[w]);
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1][0];
        low[parent] = Math.min(low[parent], low[v]);
      }
      if (low[v] === index[v]) {
        const comp: number[] = [];
        let w: number;
        do {
          w = stack.pop()!;
          onStack[w] = false;
          comp.push(w);
        } while (w !== v);
        result.push(comp.sort((a, b) => a - b));
      }
    }
  }
  return result;
}

function classPeriod(states: number[], adj: number[][]): number | null {
  const inClass = new Set(states);
  const depth = new Map<number, number>([[states[0], 0]]);
  const queue = [states[0]];
  let g = 0;
  let hasEdge = false;
  while (queue.length) {
    const u = queue.shift()!;
    for (const v of adj[u]) {
      if (!inClass.has(v)) continue;
      hasEdge = true;
      if (!depth.has(v)) {
        depth.set(v, depth.get(u)! + 1);
        queue.push(v);
      } else {
        g = gcd(g, Math.abs(depth.get(u)! + 1 - depth.get(v)!));
      }
    }
  }
  if (!hasEdge) return null;
  return g;
}

export function reachableFrom(adj: number[][], sources: number[]): boolean[] {
  const seen = new Array(adj.length).fill(false);
  const stack = [...sources];
  for (const s of sources) seen[s] = true;
  while (stack.length) {
    const u = stack.pop()!;
    for (const v of adj[u]) if (!seen[v]) { seen[v] = true; stack.push(v); }
  }
  return seen;
}

export function classifyChain(chain: CompiledChain): AnalysisOutcome<StructureResult> {
  const n = chain.P.length;
  const adj = supportGraph(chain.P);
  const comps = stronglyConnectedComponents(adj).sort((a, b) => a[0] - b[0]);
  const classOf = new Array(n).fill(-1);
  comps.forEach((c, k) => c.forEach((s) => (classOf[s] = k)));
  const classes: CommunicatingClass[] = comps.map((states, k) => ({
    states,
    closed: states.every((s) => adj[s].every((t) => classOf[t] === k)),
    period: classPeriod(states, adj),
  }));
  const absorbing = chain.P.flatMap((row, i) => (row[i] === 1 ? [i] : []));
  const transient = classes.filter((c) => !c.closed).flatMap((c) => c.states).sort((a, b) => a - b);
  const starts = chain.initial.flatMap((p, i) => (p > 0 ? [i] : []));
  return {
    status: 'ok',
    result: {
      classes,
      classOf,
      absorbing,
      transient,
      irreducible: classes.length === 1,
      reachableFromInitial: reachableFrom(adj, starts),
    },
    method: 'Tarjan strongly connected components on positive support; BFS-depth gcd for periods',
    warnings: [],
    modelHash: chain.modelHash,
  };
}
