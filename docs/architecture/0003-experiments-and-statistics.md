# ADR 0003 — Experiment engine, worker protocol, and statistical contract

**Status:** accepted (Phase 4)

## Engine (`src/domain/simulation/experiment.ts`, `experiment-v1`)

- Replication `r` uses RNG stream `r` with the ADR 0002 draw contract. Replication 0 is therefore the same path as the animated trajectory for the same seed, and a unit test checks this.
- Paths always run their genuine transitions through `H`. They are never stopped or padded when they hit the target, so endpoint and occupancy estimates stay valid for any target.
- Aggregates are mergeable online counts and sums, with exact integer counts:
  - `endpoint[t·n+i]`: endpoint counts for each step and state
  - per-replication occupancy fraction sums and squares
  - first-hit histogram, hit count, and Σmin(T_A,H) and its squares
  - Σ T_A over hits
  - at most `traceLimit` complete traces

  Running replications [0, M) in any batch split gives identical counts; this is unit-tested.
- Memory is O((H+1)·n), not O(M·H). The plan's 10,000 × 1,000 workload on the 7-state Doomscroll model takes about 240 ms in Node.

## Worker (`src/workers/experiment.worker.ts`)

- Messages are typed (`src/workers/protocol.ts`). Every response echoes `jobId` and `modelHash`, and the UI drops any message whose job or model hash isn't current.
- Work runs in batches of about 200k transitions, yielding to the event loop between batches so cancellation is seen. Progress is sent at most 10 times per second.
- A cancelled run returns its partial accumulator, labelled with the number of completed replications. In a 100,000 × 5,000 run, cancellation was acknowledged in about 440 ms including rendering.

## Statistics (`src/domain/statistics/intervals.ts`)

- **Proportions** (endpoint Pr(Xₜ = i), Pr(T_A ≤ H)): 95% Wilson score intervals. Labelled pointwise, not simultaneous. 0/M and M/M are exact at the boundaries.
- **Means** (occupancy fraction, restricted mean E[min(T_A, H)]): one value per independent replication, with a Student-t interval (df = M − 1, exact quantile by bisecting the regularized incomplete beta). No interval is shown when M < 2. A binomial interval is never applied to visits within one trajectory.
- **Censoring:** trajectories with no hit by H are reported as a separate count and never plotted at step H. The mean among hits is labelled E[T_A | T_A ≤ H]; it is not the unconditional mean.
- **Burn-in** affects occupancy only (window t = b…H, denominator H − b + 1).
- **Exact overlays:** μₜ, Pr(T_A ≤ t) via target-killed propagation, the exact restricted mean Σ₍t<H₎(1 − F(t)), and the exact expected occupancy.
- **Agreement tests** use predeclared seeds and 5·SE tolerances, so the CI suite has no random failures.

## Exports

- **CSV:** long format with provenance header rows, state IDs and labels, counts, M, interval bounds, and exact values. Text cells starting with a spreadsheet formula character are neutralized.
- **Run bundle JSON:** config, model snapshot (P, μ₀, IDs, labels, hash), engine and RNG versions, timestamps, completion status, raw counts, and traces. It contains no `NaN` or `Infinity`.
