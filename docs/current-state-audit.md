# Current-state audit (Phase 0)

Audit of the pre-upgrade app at commit `e8d5fb4`, made before the Phase 1 foundation slice. Baseline: `npm run build` passed (Vite 5.4.21, single 729 kB chunk). The repository had no tests, lint, or typecheck scripts.

## Stack and versions (from the lockfile)

React 18.3, TypeScript 5.5, Vite 5.4, `@xyflow/react` 12.10.1, Recharts 2.15.4, `lucide-react` 0.400.0. `reactflow` 11 is also listed as a dependency, but nothing imports it. It is left in place: dependency cleanup is a separate change.

## Pre-upgrade architecture

| Area | File | Notes |
| --- | --- | --- |
| Model state | `src/hooks/useMarkovModel.ts` | `useState` arrays of nodes `{id,name,x,y}` and edges `{id,source,target,probability}`. The matrix was derived by summing edges (`+=`), so duplicate edges were silently added together. |
| Math | `src/lib/markov.ts` | Matrix/vector products, `Math.random` sampler (unused), stationary distribution via P¹⁰²⁴ with rows averaged. |
| Graph | `GraphEditor`, `CircleNode`, `ArcEdge` | Floating quadratic arcs with an "eye" split for A↔B; self-loops drawn above the node. 1px center handles. |
| Matrix | `MatrixEditor` | `<input type=number>`; `parseFloat(v) \|\| 0`. |
| Analysis UI | `App.tsx` | Normalized every row before computing, and always started from the first state. |
| Examples | `src/lib/examples.ts` | **Six** examples (Weather, Stock Market, Mini PageRank, SIR, Casino Heist, Doomscroll). The README lists four. All six are preserved. |
| Persistence | — | None. A reload lost all work. |

## Baseline defects (corrected in Phase 1)

| ID | Defect | Correction |
| --- | --- | --- |
| D1 | Rows were silently normalized before analysis, and an all-zero row became uniform. | Analysis runs only on a compiled valid snapshot. Repairs are explicit and undoable (Normalize row / Make absorbing / Distribute equally). |
| D2 | The stationary distribution averaged the rows of P¹⁰²⁴. That gives a uniform-start mixture for reducible chains and hides multiple closed classes. | Per-closed-class linear solve (partial pivoting), class-entry weights from μ₀, period detection, and convergence qualification. |
| D3 | An empty or partly typed cell became 0. | Edit buffers: drafts never reach the model. Out-of-range values are rejected with a message. |
| D4 | Row tolerance was 0.01 and zero rows were accepted. | εrow = 1e-12 with compensated summation. Totals never round to "1". |
| D5 | The "Joint probability" calculator ignored μ₀ (it was really conditional), and an empty path showed "0%". | Joint and Given-starting-state modes, a factor list, log probability, the first impossible step, and underflow handling. |
| D6 | The chart always started at the first state and used `monotone` smoothing. | Explicit μ₀ editor, a linear chart with point markers, a fixed [0,1] axis, and a table equivalent. |
| D7 | New states had an empty (invalid) row. Connecting set p = 0.5, which made the row invalid. | New state = self-loop 1 (the first state also gets μ₀ = 1). Drawing an edge creates a draft awaiting a probability; drawing an existing pair selects it. |
| D8 | Loading an example used a `setTimeout` hack and overwrote the work without warning. | Atomic load command (undoable) with a confirmation that offers a download. |
| D9 | The sampler used `Math.random` and `rand <= sum`, which can select a zero-probability state when u = 0. | Removed (unused). Phase 3 will add a seeded, versioned sampler. |
| D10 | Casino Heist's first state is the absorbing "Broke & Busted", so the old default start produced a flat chart. | Example data is unchanged. Example metadata now sets the start to "Playing Safe". |

## Preservation matrix (B01–B13)

| ID | Status after Phase 1 slice | Evidence |
| --- | --- | --- |
| B01 Floating arcs | Kept (`ArcEdge` geometry unchanged), restyled with tokens | Screenshots: Weather, Doomscroll |
| B02 Dynamic states | Kept. Stable IDs (`s-xxxxxxxx`), no cap | Command tests |
| B03 Inline rename | Double-click kept. Added Enter/F2 on the focused node, plus a Name field in the State tab | Manual |
| B04 Center-drag connect | Kept, now with a real 44px center handle (the outer ring drags the node). Keyboard alternative: State tab → Add transition | Scripted drag test |
| B05 Live matrix | One canonical document; graph and matrix dispatch the same commands; undo/redo | Command tests |
| B06 Row validation | Immediate, with issue list, links, and explicit repairs | Scripted invalid-row test |
| B07 Sequence calculator | Click-to-build kept; joint and conditional modes | Fixtures M02, M15 |
| B08 Stationary | Explain tab, class based | Fixtures M01–M04, M08–M10 |
| B09 Distribution chart | Exact μₜ chart plus table | Fixture M01 |
| B10 Theory | Kept, with corrected convergence wording; accessible dialog | Manual |
| B11 Examples | All six load, validate, and analyze | `tests/unit/markov.test.ts` |
| B12 Labels | "+ Add State", "Transition Matrix", "Sequence Probability Calculator", and "New Model" kept | Manual |
| B13 Stack/commands | Unchanged stack; `npm run dev` / `npm run build` kept; added `npm test`, `npm run typecheck` | CI-equivalent run |

## Known gaps (next phases)

- Storage is a single autosaved project in `localStorage`. IndexedDB, a project list, and cross-tab conflict detection are Phase 1 follow-ups.
- No Playwright E2E yet. Visual checks were done with scripted headless Chrome.
- Not implemented yet: animated sampling and seeded RNG (Phase 3), experiments (Phase 4), comparison (Phase 5), lessons and challenges (Phase 2/6).
- No self-hosted fonts; the stacks from STYLE.md fall back to system fonts.
