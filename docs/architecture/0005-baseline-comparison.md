# ADR 0005: Baseline vs. alternative comparison

**Status:** accepted (Phase 5)

## Workflow and immutability

The workflow is **Baseline → Duplicate → Modify → Run → Compare → Explain** (PLAN.md Module F).

- **Baseline.** "Use current model as baseline" stores a deep-frozen copy of the project. The copy goes through `exportDocument` and then `importDocument`, so it shares no objects with the live model.
  - It lives in `localStorage` under `markov-simulator:baseline:v1`, separately from the autosaved project.
  - On load it is validated again by the importer.
  - It is never edited. The UI can only replace it or discard it, and both actions ask for confirmation.
- **Alternative.** The live modeler project is the alternative: a duplicate with the same stable state IDs.
  - "Reset alternative to baseline" loads a copy into the modeler as one undoable step.
  - "Apply" on a sweep point uses the new `setRow` command, also undoable.

## Alignment

Defined in `src/domain/comparison/compare.ts`.

- **Stable IDs.** `alignByStableId` pairs states that share an ID.
  - States present in only one scenario are reported as added or removed.
  - Equal labels are never treated as the same state.
- **Explicit mapping.** If the models share no IDs (an unrelated model), the page asks for a mapping.
  - `alignExplicit` requires the mapping to be one-to-one.
  - Unmapped states are left out of per-state comparisons, and metrics that depend on them say why.

## Metrics and change semantics

`compareScenarios(base, alt, alignment, spec)` evaluates both chains under one `ComparisonSpec`: a shared horizon H, a target set (in baseline IDs, mapped to the alternative), and optional rewards. Each scenario keeps its own μ₀, and any μ₀ difference appears in the change list.

The reported metrics, all from μ₀:

| Metric | Notes |
| --- | --- |
| Pr(T_A ≤ H) | |
| Pr(T_A < ∞) | |
| E[T_A] | Infinite when the target may be missed |
| E[T_A \| T_A < ∞] | Labeled as conditional |
| Expected steps to absorption | |
| Probability of ending in each absorbing state | "Not defined" for a scenario where that state is not absorbing |
| Expected total reward | Optional, see below |
| μ_H and occupancy per aligned state | |

- **Reward semantics.** The reward is Σₜ₌₀..H Σᵢ μₜ(i)·r(i): r(i) is earned at each of the H + 1 observation times spent in i, with no discounting. Every state in a scenario must have a reward, or the metric is "not defined" and names the missing states.
- **Change.** `compareScalars` returns `difference` (alt − base) and `relative` ((alt − base)/|base| × 100) as `ScalarResult`s:
  - Probabilities are shown in percentage points.
  - Relative change is "not defined" when the baseline is 0, infinite, or undefined.
  - Infinite vs. finite and undefined inputs produce a "not defined" result that carries a reason. No NaN or Infinity reaches the UI.
- **Objectives.** `judge` returns no verdict unless the learner picks a goal ("Higher is better" or "Lower is better") for that metric. Chart colors only tell the two scenarios apart.

## Parameter sweeps

`rowPreservingEdit` sets P(from → to) = v and keeps the row a distribution by one explicit rule:

- **Proportional:** rescale the other entries of the row.
- **Compensate:** move the difference into or out of one named destination.

Values a rule cannot reach (no other mass to rescale, or a compensating entry that would leave [0, 1]) come back with a reason. They are never clipped. `runSweep` evaluates any metric over a grid and keeps those failed points.

## Simulation check

The optional Monte Carlo check runs both scenarios in separate workers with **independent streams**: the alternative seed is `mix32(seed ^ 0x5bd1e995)`. The design is therefore unpaired.

- Differences in proportions use the **Newcombe hybrid score** interval, built from two Wilson intervals.
- Differences in restricted means use the **Welch t** interval.
- Both intervals are pointwise 95%.

Common random numbers and paired analysis are deliberately not offered. Reusing a seed alone does not make a valid paired design.

## Exercises

Two new challenges reuse the assessment engine with new assertion kinds:

- `rows-locked`: rows that may not change must match the starter exactly.
- `transition-range`: a scenario constraint on one cell.
- `metric`: an exact threshold, with feedback that compares the learner's value to the baseline.

The challenges:

- **Compare strategies (Casino):** reach Pr(Rich) ≥ 0.12 by editing only the Feeling Lucky row, with the house rule P(Feeling Lucky → Broke) = 0.3 kept fixed.
- **Escape the trap (Doomscroll):** reach E[T(Close App)] ≤ 12 steps by editing only the Watching Reels row, keeping autoplay ≥ 0.5. Sending the freed probability to Mindless Scrolling makes things worse (17.0 steps vs. 14.754); sending it to Reading Comments works (11.805). Afterwards the learner is asked whether "shorter" was the right goal.

Locked rows are read-only in the matrix and are also enforced by the checker. Both starters are the unmodified original examples.
