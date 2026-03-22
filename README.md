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
  * *SIR Epidemic Model*: Standard epidemiological transition model.

## 🛠 Tech Stack

* **Framework**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **Graph Engine**: [@xyflow/react](https://reactflow.dev/)
* **Charts**: [Recharts](https://recharts.org/)
* **Icons**: [Lucide React](https://lucide.dev/)
* **Styling**: Vanilla CSS with Glassmorphism and Modern Aesthetics

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

## 📖 How to Use

1. **Add States**: Use the "+ Add State" button in the top header.
2. **Connect**: Drag from the center of one state to another to create a transition.
3. **Rename**: Double-click the text in a circle to rename that state.
4. **Edit Probabilities**: Use the "Transition Matrix" on the right to input exact values.
5. **Calculate Paths**: Click the state buttons in the "Sequence Probability Calculator" to see the odds of a specific chain of events.
6. **Reset**: Use the "New Model" button to start a fresh canvas.

---

*Designed for students exploring probabilistic systems.*
