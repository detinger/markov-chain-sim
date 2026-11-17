# 🔮 Markov Chain Simulator

An interactive visualization and simulation tool for Markov Chains. Built with React and TypeScript, this application allows users to design, simulate, and analyze discrete-time Markov processes through an intuitive graphical interface.

## 🚀 Features

### 1. Interactive Graph Editor

* **Floating Arcs**: Beautifully curved transition lines that automatically separate bidirectional paths (A→B and B→A) into an elegant "eye" shape.
* **Dynamic Nodes**: Add as many states as you need. Drag them effortlessly around the canvas to organize your model.
* **Inline Renaming**: Double-click any state name to edit it instantly.

### 2. Live Transition Matrix

* Edit transition probabilities directly in a clean, tabular format.
* The matrix perfectly synchronizes with the visual graph in real-time.
* Automatic validation of row sums.

### 3. Simulation & Analysis

* **Joint Probability Calculator**: Build a sequence of states (e.g., *Sunny → Rainy → Rainy*) and get the exact joint probability of that specific path.
* **Stationary Distribution**: View the long-term steady-state probabilities of your system.
* **State Distribution Chart**: Visualize how state probabilities evolve over time steps using interactive charts.

### 4. Educational Resources

* **Theory Quick Reference**: Built-in guide covering the Markov Property, Transition Matrices, Absorbing States, and more.
* **Curated Examples**:
  * *Weather Model*: Simple 2-state introduction.
  * *Casino Heist*: A complex risk/reward model with absorbing "Ruin" and "Rich" states.
  * *The Doomscroll Trap*: A 7-state psychological model of social media engagement.
  * *SIR Epidemic Model*: Simplified individual-status Markov model (one person, fixed rates — not a population epidemic).
  * Also included: *Stock Market* and *Mini PageRank*.

## 🛠 Tech Stack

* **Framework**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **Graph Engine**: [@xyflow/react](https://reactflow.dev/)
* **Charts**: [Recharts](https://recharts.org/)
* **Icons**: [Lucide React](https://lucide.dev/)
* **Styling**: Vanilla CSS with design tokens (see `STYLE.md`), light/dark/system themes
* **Tests**: [Vitest](https://vitest.dev/) for the pure math core in `src/domain/markov`

## 📦 Installation & Setup

Ensure you have [Node.js](https://nodejs.org/) installed on your system.

1. **Clone the repository** (or download the source):

    ```bash
    git clone <repository-url>
    cd MarkovChain
    ```

2. **Install dependencies**:

    ```bash
    npm install
    ```

3. **Run the development server**:

    ```bash
    npm run dev
    ```

    The application will be available at `http://localhost:5173` (or the port specified in your terminal).

4. **Build for production**:

    ```bash
    npm run build
    ```

5. **Run tests / typecheck**:

    ```bash
    npm test -- --run
    npm run typecheck
    ```

## 📖 How to Use

1. **Add States**: Use the "+ Add State" button in the toolbar. A new state starts with a self-loop of 1 so every row stays valid.
2. **Connect**: Drag from the center of one state to another (or use *State → Add transition*). The new arc is a dashed draft until you give it a probability.
3. **Rename**: Double-click a state (or select it and press Enter).
4. **Edit Probabilities**: Use the "Transition Matrix" in the inspector. Rows must total exactly 1; the *Validate* tab explains problems and offers undoable repairs.
5. **Choose a start**: Set the starting distribution μ₀ under the matrix (a single state or a custom distribution).
6. **Calculate Paths**: The *Sequence* tab computes joint or given-start path probabilities with a factor-by-factor breakdown.
7. **Simulate**: "Run simulation" (or *Sample trajectory* in the lower panel) animates one seeded random path. Play/Pause/Step/Step back/Stop/Reset never change the path; the same seed always reproduces it. "Explain this step" shows the random draw and the row's probability intervals. Export the trace as CSV.
8. **Analyze**: The *Explain* tab (and the fuller *Analysis* page) shows communicating classes, periods, stationary distribution(s), absorption probabilities and expected visits, and — for a chosen target set — hitting probabilities, unconditional vs. conditional expected hitting times, Pr(T ≤ t), and mean return times.
9. **Experiment**: The *Experiments* page runs thousands of independent seeded trajectories in a background worker (cancellable) and compares estimates — with 95% Wilson / Student-t intervals and explicit censoring — against exact values. Export CSV or a full run bundle.
10. **Compare**: The *Compare* page freezes the current model as a baseline; keep editing in the modeler and compare exact results (reach probabilities, hitting and absorption times, absorption outcomes, per-state distribution and occupancy, optional rewards) under one shared definition. Changes are shown in percentage points, relative change only where defined, and nothing is labeled better or worse unless you set a goal. Includes row-preserving parameter sweeps and an optional Monte Carlo check with independent streams.
11. **Learn**: *Lessons* (levels 1–5, from foundations to Monte Carlo experiments) pair a worked model with an interactive demo, a common mistake, and a quick check. Twelve *Challenges* — from repairing a row to interpreting simulation uncertainty and comparing strategies — are graded from exact calculations, explain common wrong answers, show a rubric checklist, and offer progressive hints. *Examples* include the original stories plus six small teaching examples. Progress is saved on this device and can be exported or reset.
12. **Save**: Work autosaves on this device; use Export/Import for project files. Undo/redo with Ctrl/⌘+Z.
13. **Reset**: Use the "New Model" button to start a fresh canvas (undoable).

---

*Designed for students exploring probabilistic systems.*
