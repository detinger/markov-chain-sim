# ADR 0002 — Counter-based RNG and trajectory draw contract

**Status:** accepted (Phase 3)

## Context

PLAN.md Module D/E requires a versioned PRNG with published seed encoding, reference vectors, and streams assigned by replication index, so a path is identical regardless of stepping, playback speed, rewind, batching, or worker count. `Math.random()` is banned from domain code.

## Decision

**Algorithm `markov-ctr32x2-v1`** (`src/domain/simulation/rng.ts`) is a stateless, counter-based generator:

```
mix32(x)    = lowbias32 integer hash (Wellons): x^=x>>>16; x*=0x7feb352d; x^=x>>>15; x*=0x846ca68b; x^=x>>>16
key(s, r)   = mix32( mix32(s ^ 0x9e3779b9) ^ mix32(r + 0x632be5ab) )
a           = mix32( key ^ mix32(2c) )
b           = mix32( key ^ mix32(2c + 1) )
u(s, r, c)  = ((a >>> 5)·2²⁶ + (b >>> 6)) / 2⁵³        ∈ [0, 1), 53-bit resolution
```

- **Seed encoding:** an unsigned 32-bit integer `s` (0…4 294 967 295), shown and exported in decimal.
- **Streams:** replication index `r` (0…2³²−1). The animated trajectory uses stream 0. Experiments (Phase 4) use stream = replication index.
- **Counter:** draw index `c` within a stream (0…2³⁰ is supported).
- Because every draw is a pure function of `(s, r, c)`, there is no generator state. Replay, rewind, and pause can never shift later draws, and scheduling cannot change results.
- Reference vectors live in `tests/unit/simulation.test.ts`. Any change to the outputs requires a new algorithm name.

This is a hash-based generator chosen for reproducibility and simplicity in an educational tool. It is not cryptographic. It passes the uniformity smoke tests in the suite, but it has not been run through TestU01/PractRand; a later version may switch to Philox under a new name.

## Draw contract (`trajectory-v1`)

- Draw `c = 0` samples `X₀` from μ₀ (or the configured start override). A point mass still consumes the draw.
- Draw `c = t` (t ≥ 1) samples `Xₜ` from row `P[Xₜ₋₁]`, including deterministic rows.
- **Categorical sampling:** positive entries are taken in canonical state order, and their cumulative bounds are built with compensated sums. The last positive bound is set to exactly 1. That correction is made only on a compiled, valid row; it never covers for an invalid row. The sampler selects the first destination whose bound is **strictly greater** than `u`. Zero-probability destinations are never in the table, so they can never be selected.
- **Absorption stop (optional):** the path ends at the first time `t ≥ 0` at which `Xₜ` is absorbing (`P[i][i] = 1`). Without it, absorbing self-loops are shown through the horizon.
- Horizon `H` means `H` transitions and `H+1` states.

## Consequences

The UI precomputes the whole trace for the current configuration, and playback only moves a playhead. Animation speed, reduced motion, theme, and navigation cannot consume draws. Phase 4 workers can reuse `simulateTrajectory` with stream = replication index.
