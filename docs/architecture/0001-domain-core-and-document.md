# ADR 0001 — Pure domain core, canonical document, command history

**Status:** accepted (Phase 1 foundation slice)

## Decision

- `src/domain/markov/` holds every mathematical function. It has no React, storage, clock, or React Flow imports. UI components call `compileChain`, `pathProbability`, `evolveDistribution`, `stationaryDistributions`, `absorptionAnalysis`, and `hittingAnalysis`, and never compute probabilities themselves.
- The canonical model is `ChainDocumentV1` (PLAN.md §7.3): sparse transitions keyed by stable state IDs, an explicit `initial` vector, and layout kept separate from mathematics. An omitted transition means exactly 0. Setting a cell to 0 removes the transition.
- Every model edit is a `Command` applied by `applyCommand`. `useProject` keeps undo/redo history (limit 200). Text edits and drags coalesce into one undo step through a per-session key. Loading an example, an import, or a new model is also a history entry, so it can be undone.
- Compilation produces a frozen `CompiledChain` plus a `modelHash` over (ordered IDs, P, μ₀). Renaming and dragging don't change the hash. When the document is invalid, the last valid snapshot is used and its results are labelled as coming from an earlier model version.
- Numerical policy: εrow = 1e-12 (compensated sums, rescale within tolerance and record it), εsolve = 1e-10, display to 4 decimals. Linear solves use Gaussian elimination with partial pivoting; no explicit inverses except N, which is solved against I.
- Stationary distributions are computed per closed communicating class (Tarjan SCC). Class-entry weights come from solving (I−Q)H = R. Convergence is reported as guaranteed only when every closed class with positive weight is aperiodic.

## Interim choices

- **Persistence:** `localStorage` key `markov-simulator:autosave:v1`, debounced 500 ms, with Saving / Saved / Save failed status and JSON export as the fallback. IndexedDB with multiple projects replaces this later, behind the same import/export schema.
- **State colors:** index in `doc.states` (creation order), not label or position. User colors in `layout.colors` take precedence.
- **Draft edges:** a selected transition with probability 0 is shown as a dashed draft edge. It becomes mathematical only once a positive probability is entered.
- **Styles:** `tokens.css` (exact STYLE.md §12 values plus the labelled Markov additions), `app.css` (global, components, and features combined for now), `flow-theme.css`.
