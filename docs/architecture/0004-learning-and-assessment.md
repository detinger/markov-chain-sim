# ADR 0004 — Lessons, challenges, and deterministic assessment

**Status:** accepted (Phase 2)

## Content as versioned data

- `src/data/lessons.ts` holds levels 1–4: 9 lessons with stable IDs, a `version`, prerequisites, one objective, an effort estimate, and a next step. A lesson is a list of typed sections:
  - text
  - formula (with a spoken text alternative)
  - model (diagram, a description, and an inspectable matrix)
  - demo-evolve and demo-path (interactive)
  - mistake
  - check and numeric-check
  - try (link to a challenge)

  Level 5 (experiments) is deferred to Phase 6.
- `src/data/challenges.ts` holds the first four challenges from PLAN §5: Repair a row, Build weather, Predict a path, Predict two steps. Each has a starter snapshot, assertions, three progressive hints, a rubric, a reference solution, and a next concept.
- Lesson and challenge models use a compact `ModelSnapshot` (dense P in state order). `snapshotToDocument` and `documentToSnapshot` convert to and from the canonical document.

## Assessment (`src/domain/assessment`)

- Assertions are typed data:
  - `rows-valid` and `initial-valid`
  - `state-count`
  - `transition` (role-based, with a tolerance)
  - `transition-positive` (blocks trivial "make everything absorbing" repairs)
  - `numeric-answer` (expected value computed from the model via `pathProbability` / `evolveDistribution`, never typed in)
- **Permutation tolerance:** learners map semantic roles (Sunny, Rainy) to their own states. `suggestRoles` pre-fills the mapping from labels, and the learner can override it. Coordinates and state order are never graded.
- **Feedback** has three parts: what is correct, what needs attention and why, and next. A transposed matrix produces a row-direction explanation.
- **Answer parsing** accepts decimals, scientific notation, `a/b`, `x%`, and decimal commas. Input is never evaluated as code.
- **Tests:** every lesson model is valid. Worked numeric answers match computed values, and multiple-choice keys are checked against the analysis functions. Every reference solution passes and every starter fails with a reason.

## Progress

- Stored in `localStorage` key `markov-simulator:progress:v1`. It tracks lesson checks (correct and attempts), completion time, and challenge attempts, hints used, and solve time.
- If a lesson's or challenge's `version` changes, its saved entry is dropped on load and the learner sees a note.
- Progress can be exported as JSON separately from models. Reset asks for confirmation and offers an export first.
- Hints are recorded but never withhold the challenge. The modeler is never gated.

## Contextual validation

`structuralIssues` adds validation layers 3–4. They never block anything:

- **Information:** reducible chain, multiple closed classes, periodic class, states unreachable from the start, absorbing states.
- **Capability warning:** large model (more than 50 states).
- **Recommendation:** no step meaning set.

`ISSUE_LESSONS` links issue codes to lessons. The State inspector and the Examples dialog link to related lessons too.
