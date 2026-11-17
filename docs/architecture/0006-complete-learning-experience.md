# ADR 0006: Completing the learning experience

**Status:** accepted (Phase 6)

## Content

- **Lessons:** levels 1–5, 12 lessons in total. Level 5 (Experiments) adds three:
  - `experiments.estimates`: seeds, independent replications, Wilson intervals, 1/√M.
  - `experiments.censoring`: right-censoring, restricted mean, the conditional mean among hits.
  - `experiments.comparing`: percentage points, when a relative change is defined, and stating the goal before judging.

  A new `demo-experiment` section runs the pure seeded engine synchronously (at most 5,000 replications over a short horizon). It shows the estimate, a Wilson interval bar, and the exact value.
- **Challenges:** all twelve types from PLAN §5, one instance each.
  - **New in this phase:** Stationary is not convergence, Find closed classes, Casino outcomes (two-table casino; answers 3/7, 4/7, 16/7), First hit versus occupancy, Diagnose the SIR abstraction, and Interpret uncertainty. The last shows fixed-seed runs with M = 50 and M = 5,000.
  - **Level changes:** Compare strategies and Escape the trap move to level 5 (comparisons).

## Assessment additions

These live in `src/domain/assessment`.

- **New numeric targets.** All are computed from the model, never typed in:
  - `stationary`: π(state) of a unique stationary distribution.
  - `absorb`: probability of eventual absorption into a state, from a given state.
  - `expected-steps`: expected steps to absorption from a given state.
  - `hit-by`: Pr(T_A ≤ t) from μ₀.
- **New answer types:**
  - `choice-answer`: carries one explanation per choice.
  - `state-set`: the learner ticks states; the correct set is computed with `classifyChain`. Feedback names wrongly included states but only counts missing ones, so it does not give the answer away.
- **Explaining wrong answers.** `diagnoseNumeric` lists the values a specific misconception produces:
  - the other path mode (joint instead of conditional, or the reverse);
  - reading the matrix by columns;
  - taking one path for "all paths";
  - giving the one-step probability as the absorption probability;
  - giving the time to leave the start as the time to absorption;
  - giving occupancy μₜ(A) for a first-arrival question;
  - giving μ₁ as π.

  A wrong answer that matches one of these gets that explanation. Matching never awards credit, and a test confirms the correct value is never flagged.
- **Rubric checklist.** Every assertion has a `criterion`, shown as a checklist next to the three-part feedback. Criteria are unique within each challenge.

## Progress migration

`migrateProgress` (in `src/features/learning/migrateProgress.ts`) is pure and tested on its own.

| Saved data | Result |
| --- | --- |
| Same version | Kept |
| Older, but at or above `progressCompatibleFrom` | Kept and upgraded to the current version |
| Older than that | Reset, with a note to the learner |
| Removed questions | Dropped |
| Removed content | Dropped silently |
| Malformed values | Sanitized |
| Foreign schema or invalid JSON | Reported as `unreadable`; `useProgress` copies the raw value to `markov-simulator:progress:backup` before it can be overwritten |

The four lessons that only gained "Try it" links are now version 2 with `progressCompatibleFrom: 1`, so learners keep their progress.

## Examples and framing

- **Teaching examples.** `TEACHING_EXAMPLES` adds the six small examples from §6: deterministic alternator, two absorbing outcomes, reducible classes, sticky rare transition, unreachable target, and a one-state chain. Each has goals, assumptions and a related lesson, and tests check its stated analytic properties. The original `EXAMPLES` data is unchanged, and `ALL_EXAMPLES` lists the originals first.
- **Framing review:**
  - **SIR:** remains labeled "Simplified individual-status Markov model". The notes now add that it cannot produce an outbreak peak, and that waiting times are geometric (20 days on average until infection, 5 days infected).
  - **Casino:** notes that real games are designed so players lose on average, and that the model has no money amounts.
  - **Doomscroll:** probabilities are invented, the state labels are story labels rather than diagnoses, and a step is a fixed time slice.

## Accessibility review (scripted)

Every page and the Examples dialog were checked with scripted headless Chrome for:
- interactive controls with no accessible name;
- duplicate IDs;
- positive tabindex;
- images without alt text;
- a real Tab-key walk that confirms every stop shows a visible focus ring.

| Finding | Fix |
| --- | --- |
| The Modeler had no page heading | Added a visually hidden `h1` |
| Nav buttons were announced twice ("Modeler Modeler") | Removed the duplicate hidden label; when the nav is collapsed, the `title` still names the button |
| Lesson check questions rendered on the card border | Floated the `legend` inside the card |

Radio groups respond to arrow keys.

**Not done:** a novice walkthrough with real learners, and testing with an actual screen reader (VoiceOver or NVDA).
