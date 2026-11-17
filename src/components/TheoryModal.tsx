import { Grid, IterationCcw, Lock, TrendingUp } from 'lucide-react';
import { Dialog } from './ui';

export default function TheoryModal({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Markov chains: quick reference" onClose={onClose}>
      <section className="prose">
        <h3>What is a Markov chain?</h3>
        <p>
          A Markov chain is a mathematical system that models transitions from one state to another according to certain probabilistic rules.
          The defining characteristic of a Markov chain is the <strong>Markov property</strong>: <em>“The future depends only on the present, not on the past.”</em>{' '}
          It does not matter how you arrived at your current state; the odds of where you go next are exactly the same.
        </p>
        <p className="hint">In this app, one step is a discrete index. An example may say what a step means (“day”, “round”), but a step is not inherently a unit of time.</p>
      </section>

      <div className="theory-grid">
        <div className="card">
          <h4><Grid size={18} aria-hidden /> States &amp; transitions</h4>
          <p>
            <strong>States (nodes):</strong> the distinct situations the system can be in (e.g. “Sunny” or “Rainy”).<br /><br />
            <strong>Transitions (edges):</strong> the arrows connecting states. The number on the arrow is the <em>probability</em> of moving from the source to the target in the next step.
            All outgoing probabilities from a single state must always sum to <strong>1</strong>.
          </p>
        </div>
        <div className="card">
          <h4><TrendingUp size={18} aria-hidden /> Transition matrix</h4>
          <p>
            A square grid where the rows are the <em>current state</em> (From) and the columns are the <em>next state</em> (To).
            The value at row <em>i</em> and column <em>j</em> is the probability of jumping from state <em>i</em> to state <em>j</em>: <code>P[i][j] = Pr(Xₜ₊₁ = j | Xₜ = i)</code>.
          </p>
        </div>
        <div className="card">
          <h4><IterationCcw size={18} aria-hidden /> Stationary distribution</h4>
          <p>
            A distribution π with <code>πP = π</code>: if the chain starts there, it stays there. For an irreducible chain, π is unique and gives the long-run fraction of time spent in each state.
            The distribution μₜ also <em>converges</em> to π only when the chain is aperiodic; a periodic chain (like A ⇄ B) can oscillate forever. Reducible chains can have several stationary distributions.
          </p>
        </div>
        <div className="card">
          <h4><Lock size={18} aria-hidden /> Absorbing states</h4>
          <p>
            An absorbing state is a “trap”. Once the system enters it, it can never leave. Mathematically, it has a self-loop with probability exactly <strong>1</strong> (and 0 for everything else).
            Example: “Broke &amp; Busted” in the Casino Heist scenario. A closed group of several states is recurrent but not absorbing.
          </p>
        </div>
      </div>

      <section className="prose">
        <h3>Joint probability of a sequence</h3>
        <p>
          To find the probability of a specific chain of events in exact order (e.g. A → B → C), multiply the transition probabilities of each step.
          Given that the chain starts in A:
        </p>
        <div className="formula" aria-label="P of A then B then C given start A equals P of A to B times P of B to C">P(A → B → C | X₀ = A) = P(A→B) × P(B→C)</div>
        <p style={{ marginTop: 10 }}>The <strong>joint</strong> probability also includes the chance of starting in A:</p>
        <div className="formula" aria-label="joint probability equals mu zero of A times P of A to B times P of B to C">Pr(X₀=A, X₁=B, X₂=C) = μ₀(A) × P(A→B) × P(B→C)</div>
        <h3 style={{ marginTop: 18 }}>Distribution after t steps</h3>
        <div className="formula">μₜ₊₁ = μₜ P &nbsp;&nbsp;⇒&nbsp;&nbsp; μₜ = μ₀ Pᵗ</div>
        <p className="hint" style={{ marginTop: 8 }}>(Pᵗ)[i][j] is the probability of being in j after exactly t steps from i, not the probability of first arriving there at step t.</p>
      </section>
    </Dialog>
  );
}
