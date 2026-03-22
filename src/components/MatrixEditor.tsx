import { MarkovNode } from '../hooks/useMarkovModel';

interface MatrixEditorProps {
  nodes: MarkovNode[];
  matrix: number[][];
  onUpdateProbability: (sourceId: string, targetId: string, prob: number) => void;
}

export default function MatrixEditor({ nodes, matrix, onUpdateProbability }: MatrixEditorProps) {
  return (
    <div className="matrix-editor" style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px', overflowX: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>Transition Matrix</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
         <thead>
           <tr>
             <th style={{ padding: '0.5rem' }}>From \ To</th>
             {nodes.map(n => <th key={n.id} style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>{n.name}</th>)}
           </tr>
         </thead>
         <tbody>
           {nodes.map((source, i) => {
             const rowSum = matrix[i].reduce((a, b) => a + b, 0);
             const isValidRow = Math.abs(rowSum - 1.0) < 0.01 || rowSum === 0; // 0 is okay for absorbing (we might normalize later)
             
             return (
               <tr key={source.id}>
                 <th style={{ padding: '0.5rem', borderRight: '1px solid var(--border-color)', textAlign: 'left' }}>
                   {source.name}
                   {!isValidRow && <span style={{ color: '#ef4444', fontSize: '12px', marginLeft: '8px' }}>Sum ≠ 1</span>}
                 </th>
                 {nodes.map((target, j) => (
                   <td key={target.id} style={{ padding: '0.5rem' }}>
                     <input 
                       type="number"
                       step="0.05"
                       min="0"
                       max="1"
                       value={matrix[i][j]}
                       onChange={(e) => onUpdateProbability(source.id, target.id, parseFloat(e.target.value) || 0)}
                       style={{ 
                         width: '60px', 
                         padding: '4px', 
                         background: 'var(--bg-primary)', 
                         color: 'var(--text-primary)', 
                         border: '1px solid var(--border-color)',
                         borderRadius: '4px'
                       }}
                     />
                   </td>
                 ))}
               </tr>
             )
           })}
         </tbody>
      </table>
    </div>
  );
}
