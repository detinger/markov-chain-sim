import { X, BookOpen, IterationCcw, TrendingUp, Grid } from 'lucide-react';

interface TheoryModalProps {
  onClose: () => void;
}

export default function TheoryModal({ onClose }: TheoryModalProps) {
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--bg-primary, #0f172a)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '800px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ 
          position: 'sticky', top: 0, background: 'var(--bg-primary)', 
          padding: '1.5rem', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 
        }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc' }}>
            <BookOpen size={24} color="var(--accent)" /> Markov Chains: Quick Reference
          </h2>
          <button 
            onClick={onClose}
            style={{ 
              background: 'transparent', border: 'none', color: 'var(--text-secondary)', 
              cursor: 'pointer', display: 'flex' 
            }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', color: 'var(--text-primary)' }}>
          
          <section>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>
              What is a Markov Chain?
            </h3>
            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              A Markov Chain is a mathematical system that models transitions from one state to another according to certain probabilistic rules. 
              The defining characteristic of a Markov chain is the <strong>Markov Property</strong>: 
              <em> "The future depends only on the present, not on the past."</em> 
              It does not matter how you arrived at your current state; the odds of where you go next are exactly the same.
            </p>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            
            <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Grid size={18} color="var(--accent)"/> States & Transitions
              </h4>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                <strong>States (Nodes):</strong> The distinct situations the system can be in (e.g., "Sunny" or "Rainy").<br/><br/>
                <strong>Transitions (Edges):</strong> The arrows connecting states. The number on the arrow represents the <em>probability</em> of moving from the source to the target in the next time step. All outgoing probabilities from a single state must always sum to <strong>1.0 (100%)</strong>.
              </p>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} color="var(--accent)"/> Transition Matrix
              </h4>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                A square grid (matrix) where the rows represent the <em>Current State</em> and the columns represent the <em>Next State</em>. The value at row <em>i</em> and column <em>j</em> is precisely the probability of jumping from state <em>i</em> to state <em>j</em>.
              </p>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IterationCcw size={18} color="var(--accent)"/> Stationary Distribution
              </h4>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                If you let the Markov chain run for an infinite amount of time, the <strong>Stationary Distribution</strong> tells you the overall percentage of time the system spends in each state. It represents the "long-term equilibrium" or steady state of the system probabilities.
              </p>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <X size={18} color="#f43f5e"/> Absorbing States
              </h4>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                An absorbing state is a "trap". Once the system enters this state, it can never leave. Mathematically, this is represented by a self-loop transition back to itself with a probability of exactly <strong>1.0</strong> (and 0 for everything else). Example: "Broke" in a casino scenario.
              </p>
            </div>

          </div>

          <section style={{ background: 'var(--accent)', padding: '1.5rem', borderRadius: '8px', color: '#fff' }}>
            <h3 style={{ marginTop: 0 }}>Joint Probability of a Sequence</h3>
            <p style={{ margin: 0, lineHeight: '1.6', fontSize: '0.95rem' }}>
              To find the probability of a specific chain of events occurring in exact order (e.g., A → B → C), you simply multiply the transition probabilities of each individual step together: <br/>
              <code>P(A → B → C) = P(A → B) × P(B → C)</code>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
