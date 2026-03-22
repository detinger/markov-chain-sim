import { useMemo, useState } from 'react';
import GraphEditor from './components/GraphEditor';
import MatrixEditor from './components/MatrixEditor';
import SimulationChart from './components/SimulationChart';
import SequenceCalculator from './components/SequenceCalculator';
import TheoryModal from './components/TheoryModal';
import { useMarkovModel } from './hooks/useMarkovModel';
import { calculateStepsDistribution, getStationaryDistribution } from './lib/markov';
import { Plus, BookOpen, FileMinus, Info } from 'lucide-react';
import { EXAMPLES } from './lib/examples';

function normalizeMatrix(matrix: number[][]): number[][] {
  return matrix.map(row => {
    const sum = row.reduce((a, b) => a + b, 0);
    if (sum === 0) return Array(row.length).fill(1 / row.length); // fallback if all zero
    return row.map(v => v / sum);
  });
}

function App() {
  const { nodes, edges, transitionMatrix, setNodes, setEdges, onNodesChange, onEdgesChange, onConnect, updateEdgeProbability } = useMarkovModel();

  const [steps] = useState(20);
  const [showTheory, setShowTheory] = useState(false);

  // For simulation, we assume initial probability vector starts strongly at Node 0.
  // In a real robust app we could make initial state customizable.
  const history = useMemo(() => {
    if (nodes.length === 0) return [];

    // Normalize matrix so we don't blow up if users left some rows partial
    const normalized = normalizeMatrix(transitionMatrix);
    const initialDistribution = Array(nodes.length).fill(0);
    initialDistribution[0] = 1; // start at First Node

    return calculateStepsDistribution(initialDistribution, normalized, steps);
  }, [nodes, transitionMatrix, steps]);

  const stationaryDistribution = useMemo(() => {
    if (nodes.length === 0) return [];
    const normalized = normalizeMatrix(transitionMatrix);
    return getStationaryDistribution(normalized);
  }, [nodes, transitionMatrix]);

  const handleAddNode = () => {
    const newId = (nodes.length > 0 ? Math.max(...nodes.map(n => parseInt(n.id) || 0)) + 1 : 1).toString();
    setNodes(prev => [...prev, { id: newId, name: `State ${newId}`, x: Math.random() * 200 + 50, y: Math.random() * 200 + 50 }]);
  };

  const handleNewModel = () => {
    setNodes([]);
    setEdges([]);
  };

  const renameNode = (id: string, newName: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, name: newName } : n));
  };

  const loadExample = (id: string) => {
    if (EXAMPLES[id]) {
      setNodes(EXAMPLES[id].nodes);
      // Wait a tick for nodes to apply before applying edges to avoid dangling edges
      setTimeout(() => setEdges(EXAMPLES[id].edges), 10);
    }
  };

  return (
    <div className="app-container">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BookOpen /> Markov Chain Simulator</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select
            onChange={(e) => loadExample(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
            defaultValue=""
          >
            <option value="" disabled>Load Example...</option>
            {Object.entries(EXAMPLES).map(([key, ex]) => (
              <option key={key} value={key}>{ex.name}</option>
            ))}
          </select>
          <button 
            onClick={() => setShowTheory(true)} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
          >
            <Info size={16} /> Concepts
          </button>
          <button onClick={handleAddNode} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent)', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
            <Plus size={16} /> Add State
          </button>
          <button 
            onClick={handleNewModel} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              background: 'var(--bg-secondary)', 
              color: 'var(--text-primary)', 
              border: '1px solid var(--border-color)', 
              padding: '0.5rem 1rem', 
              borderRadius: '4px', 
              cursor: 'pointer' 
            }}
          >
            <FileMinus size={16} /> New Model
          </button>
        </div>
      </header>
      <main className="main-content" style={{ display: 'flex', gap: '1rem', overflow: 'hidden' }}>
        <div style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', background: '#f1f5f9' }}>
          <GraphEditor
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeRename={renameNode}
          />
        </div>
        <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
          <MatrixEditor
            nodes={nodes}
            matrix={transitionMatrix}
            onUpdateProbability={updateEdgeProbability}
          />
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Stationary Distribution</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {nodes.map((n, i) => (
                <div key={n.id} style={{ background: 'var(--bg-primary)', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{n.name}</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent)' }}>{(stationaryDistribution[i] * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
          <SimulationChart history={history} nodes={nodes} />
          <SequenceCalculator nodes={nodes} matrix={transitionMatrix} />
        </div>
      </main>
      
      {showTheory && <TheoryModal onClose={() => setShowTheory(false)} />}
    </div>
  )
}

export default App
