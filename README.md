# 🔮 Markov Chain Simulator

An interactive web app for learning and exploring discrete-time Markov chains. You can:

- draw a chain on a canvas;
- check that it is valid;
- watch a seeded random path unfold;
- compute exact long-run and first-passage results;
- run Monte Carlo experiments with honest uncertainty;
- compare a baseline with an alternative;
- learn the theory through lessons and graded challenges.

Everything runs in the browser. There is no backend, no account, and no data leaves your device.

---

## Features

| Page | What you can do |
| --- | --- |
| **Modeler** | Add states, drag between them to create transitions, and edit probabilities on the canvas or in the transition matrix. The **Validate** tab explains every problem and offers undoable repairs. The **Sequence** tab computes path probabilities, and **Explain** summarizes the chain's structure. Undo and redo with Ctrl/⌘+Z. |
| **Simulation** (lower panel) | Shows the exact distribution μₜ over time, or animates one seeded sample path. The same seed always gives the same path. *Explain this step* shows the random draw. Traces export to CSV. |
| **Analysis** | Communicating classes, periods, stationary distribution(s), absorption probabilities, and expected visits. For a target set: hitting probabilities, unconditional and conditional expected hitting times, Pr(T ≤ t), and mean return times. |
| **Experiments** | Thousands of independent seeded trajectories, run in a background worker you can cancel. Estimates come with 95% Wilson or Student-t intervals and explicit censoring, next to the exact values. Results export as CSV or a full run bundle. |
| **Compare** | Freeze the current model as a baseline, edit a copy, and compare exact results under one shared definition. Changes are shown in percentage points, and relative change only where it is defined. Includes row-preserving parameter sweeps and an optional simulation check. Nothing is called "better" unless you state a goal. |
| **Lessons** | 12 lessons across five levels: foundations, evolution, long-run behavior, absorption, and experiments. Each has a worked model, an interactive demo, a common mistake, and a knowledge check. |
| **Challenges** | 12 exercises, from repairing a row to interpreting simulation uncertainty. They are graded from exact calculations, explain common wrong answers, show a rubric checklist, and offer progressive hints. |
| **Examples** | The original story models (Weather, Stock Market, Mini PageRank, SIR, Casino Heist, Doomscroll Trap) with their assumptions and limits stated. There are also six small teaching examples. |

Light, dark, and system themes are supported. The layout works from phone width up, and every control is reachable by keyboard.

### Where your data lives

| Data | Where |
| --- | --- |
| Current model | Autosaved in this browser's local storage. Use **Export / Import** for `.markov.json` files. |
| Comparison baseline | Saved separately in local storage. |
| Learning progress | Saved in local storage. It can be exported or reset from the Lessons page. |

Clearing site data in the browser removes all of these.

---

## Quick start

You need **Node.js 20 or newer** (22 recommended; see `.nvmrc`).

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Typecheck and build the production site into `dist/` |
| `npm start` | Serve `dist/` with the bundled production server (`server.mjs`, port `$PORT` or 3000) |
| `npm run preview` | Vite's local preview of `dist/` |
| `npm test -- --run` | Run the unit tests once (Vitest) |
| `npm run typecheck` | TypeScript check only |

---

## Deployment

The build is a static site: `npm run build` produces `dist/`, which contains `index.html` and hashed files under `assets/`, including the experiment worker. No environment variables are needed. `dist/` is not committed; each host builds it.

### Netlify

The repository includes `netlify.toml`, so no settings need to be entered by hand.

1. In Netlify choose **Add new site → Import an existing project** and pick this repository.
2. Netlify reads `netlify.toml`:
   - build command `npm run build`;
   - publish directory `dist`;
   - Node 22;
   - a one-year cache for `/assets/*`;
   - basic security headers;
   - a fallback to `index.html`.
3. Deploy.

From the command line instead:

```bash
npm install -g netlify-cli
netlify deploy --build          # draft URL
netlify deploy --build --prod   # production
```

### Railway

The repository includes `railway.json` and a dependency-free Node server (`server.mjs`).

1. In Railway choose **New Project → Deploy from GitHub repo** and pick this repository.
2. Railway reads `railway.json`:
   - build with `npm run build`;
   - start with `npm start`;
   - health check at `/healthz`;
   - restart on failure.
3. Under **Settings → Networking**, choose **Generate Domain** to get a public URL.

The server:
- listens on Railway's `$PORT`;
- serves files with correct content types and gzip;
- caches hashed assets for a year and revalidates `index.html`;
- returns 404 for missing files, falls back to the app for other paths, and refuses requests outside `dist/`.

From the command line instead:

```bash
npm install -g @railway/cli
railway login
railway init        # or: railway link
railway up
```

### Any other host

- **Static hosting:** upload `dist/` after `npm run build`.
- **A Node host:** run `npm run build` and then `npm start`.

---

## Project structure

```
src/
  domain/          Pure TypeScript, no React — all mathematics lives here
    markov/        Document model, validation, structure, exact analysis
    simulation/    Seeded RNG, trajectories, Monte Carlo engine
    statistics/    Wilson, Student t, Newcombe, Welch intervals
    comparison/    Baseline/alternative alignment, metrics, sweeps
    assessment/    Challenge grading and answer diagnosis
  features/        Pages: simulation, analysis, experiments, comparison, learning, challenges
  components/      Shared UI (graph editor, matrix editor, dialogs, …)
  data/            Versioned lessons and challenges
  lib/examples.ts  Example models (original data preserved verbatim)
  workers/         Experiment web worker
  styles/          Design tokens and styles (see STYLE.md)
tests/unit/        Vitest suites for the domain code and teaching content
docs/architecture/ Decision records 0001–0006
server.mjs         Production static server (Railway / Node hosts)
```

### Design notes

The decisions are recorded in [`docs/architecture/`](docs/architecture/):
- **Mathematics:** row orientation, numerical tolerances, and how analyses are solved (ADR 0001).
- **Reproducibility:** the `markov-ctr32x2-v1` random-number generator and how each step consumes draws (ADR 0002).
- **Statistics:** intervals and censoring (ADR 0003).
- **Comparison:** how baselines and alternatives are compared (ADR 0005).
- **Assessment:** how answers are graded (ADR 0004 and 0006).

[`PLAN.md`](PLAN.md) is the upgrade plan, and [`STYLE.md`](STYLE.md) is the design system.

## Tech stack

- React 18
- TypeScript
- Vite 5
- [@xyflow/react](https://reactflow.dev/) for the graph canvas
- [Recharts](https://recharts.org/) for charts
- [Lucide](https://lucide.dev/) for icons
- Vanilla CSS with design tokens
- [Vitest](https://vitest.dev/) for unit tests

---

*Designed for students exploring probabilistic systems. The example models are illustrative, not empirical data or advice.*
