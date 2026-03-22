import React, { useState, useMemo } from 'react';
import { MarkovNode } from '../hooks/useMarkovModel';
import { Trash2, Plus, ArrowRight } from 'lucide-react';

interface SequenceCalculatorProps {
  nodes: MarkovNode[];
  matrix: number[][];
}

export default function SequenceCalculator({ nodes, matrix }: SequenceCalculatorProps) {
  const [sequence, setSequence] = useState<string[]>([]);

  const probability = useMemo(() => {
    if (sequence.length < 2) return sequence.length === 1 ? 1 : 0;
    
    let totalProb = 1.0;
    for (let i = 0; i < sequence.length - 1; i++) {
      const fromIdx = nodes.findIndex(n => n.id === sequence[i]);
      const toIdx = nodes.findIndex(n => n.id === sequence[i + 1]);
      
      if (fromIdx !== -1 && toIdx !== -1) {
        totalProb *= matrix[fromIdx][toIdx];
      } else {
        return 0;
      }
    }
    return totalProb;
  }, [sequence, nodes, matrix]);

  const addNode = (id: string) => {
    setSequence([...sequence, id]);
  };

  const removeAt = (index: number) => {
    const next = [...sequence];
    next.splice(index, 1);
    setSequence(next);
  };

  const clear = () => setSequence([]);

  return (
    <div style={{ 
      background: 'var(--bg-secondary)', 
      padding: '1.5rem', 
      borderRadius: '8px', 
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Sequence Probability Calculator</h3>
        {sequence.length > 0 && (
          <button 
            onClick={clear}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#f43f5e', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.85rem'
            }}
          >
            <Trash2 size={14} /> Clear
          </button>
        )}
      </div>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem', 
        flexWrap: 'wrap', 
        minHeight: '40px',
        padding: '0.5rem',
        background: 'var(--bg-primary)',
        borderRadius: '4px',
        border: '1px dashed var(--border-color)'
      }}>
        {sequence.length === 0 && (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Add states to build a path...</span>
        )}
        {sequence.map((id, idx) => {
          const node = nodes.find(n => n.id === id);
          return (
            <React.Fragment key={`${id}-${idx}`}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                background: 'var(--accent)',
                color: '#fff',
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.85rem'
              }}>
                {node?.name || id}
                <button 
                  onClick={() => removeAt(idx)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex' }}
                >
                  <Plus size={14} style={{ transform: 'rotate(45deg)' }} />
                </button>
              </div>
              {idx < sequence.length - 1 && <ArrowRight size={14} color="var(--text-secondary)" />}
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {nodes.map(node => (
          <button
            key={node.id}
            onClick={() => addNode(node.id)}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
          >
            + {node.name}
          </button>
        ))}
      </div>

      <div style={{ 
        marginTop: '0.5rem', 
        padding: '1rem', 
        background: 'rgba(56, 189, 248, 0.1)', 
        borderRadius: '6px',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
          Combined Joint Probability P(Sequence)
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent)' }}>
          {(probability * 100).toLocaleString(undefined, { maximumFractionDigits: 4 })}%
        </div>
        {sequence.length > 1 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {sequence.map((_, i) => {
              if (i === 0) return null;
              const fromIdx = nodes.findIndex(n => n.id === sequence[i-1]);
              const toIdx = nodes.findIndex(n => n.id === sequence[i]);
              const p = matrix[fromIdx][toIdx];
              return <span key={i}>{i > 1 ? ' × ' : ''}{p.toFixed(2)}</span>
            })}
          </div>
        )}
      </div>
    </div>
  );
}
