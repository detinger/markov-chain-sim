import { useId } from 'react';
import { formatProbability } from '../../domain/markov';
import type { ModelSnapshot } from '../../domain/assessment';

/**
 * Small static chain diagram for lessons and challenges (no React Flow). Decorative: every use is
 * accompanied by a text description and an inspectable matrix.
 */
export default function MiniChain({ snapshot, height = 260, highlight }: { snapshot: ModelSnapshot; height?: number; highlight?: string }) {
  const R = 30;
  const markerId = `mini-arrow-${useId().replace(/:/g, '')}`;
  const marker = `url(#${markerId})`;
  const states = snapshot.states;
  if (!states.length) return <div className="mini-chain empty-state" style={{ height }}><p>No states yet.</p></div>;
  const xs = states.map((s) => s.x);
  const ys = states.map((s) => s.y);
  const pad = 70;
  const vbW = Math.max(...xs) - Math.min(...xs) + 2 * pad;
  const vbH = Math.max(...ys) - Math.min(...ys) + 2 * pad + 20;
  const vb = `${Math.min(...xs) - pad} ${Math.min(...ys) - pad - 20} ${vbW} ${vbH}`;
  const edges: JSX.Element[] = [];
  states.forEach((a, i) => states.forEach((b, j) => {
    const p = snapshot.P[i]?.[j] ?? 0;
    if (p === 0) return;
    const key = `${a.id}-${b.id}`;
    const text = formatProbability(p, 2);
    if (i === j) {
      const d = `M ${a.x - 12} ${a.y - R + 2} C ${a.x - 34} ${a.y - R - 46}, ${a.x + 34} ${a.y - R - 46}, ${a.x + 12} ${a.y - R + 2}`;
      edges.push(<g key={key}><path d={d} className="mini-edge" markerEnd={marker} /><text x={a.x} y={a.y - R - 40} className="mini-label">{text}</text></g>);
      return;
    }
    const dx = b.x - a.x; const dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len; const ny = dy / len;
    const bend = (snapshot.P[j]?.[i] ?? 0) > 0 ? 22 : 0; // separate A→B and B→A
    const sx = a.x + nx * R; const sy = a.y + ny * R; const tx = b.x - nx * (R + 4); const ty = b.y - ny * (R + 4);
    const cx = (sx + tx) / 2 - ny * bend; const cy = (sy + ty) / 2 + nx * bend;
    edges.push(
      <g key={key}>
        <path d={`M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`} className="mini-edge" markerEnd={marker} />
        <text x={(sx + 2 * cx + tx) / 4 - ny * 10} y={(sy + 2 * cy + ty) / 4 + nx * 10 + 4} className="mini-label">{text}</text>
      </g>,
    );
  }));
  return (
    <svg className="mini-chain" viewBox={vb} width={vbW} height={vbH} style={{ maxWidth: '100%', maxHeight: height, height: 'auto' }} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="mini-arrowhead" />
        </marker>
      </defs>
      {edges}
      {states.map((s, i) => (
        <g key={s.id}>
          <circle cx={s.x} cy={s.y} r={R} className={`mini-node${highlight === s.id ? ' active' : ''}${snapshot.P[i]?.[i] === 1 ? ' absorbing' : ''}`} />
          <text x={s.x} y={s.y + 4} className="mini-node-label">{s.label.length > 10 ? `${s.label.slice(0, 9)}…` : s.label}</text>
        </g>
      ))}
    </svg>
  );
}

/** Inspectable matrix for a snapshot (the accessible equivalent of the diagram). */
export function SnapshotMatrix({ snapshot, caption }: { snapshot: ModelSnapshot; caption: string }) {
  return (
    <div className="table-wrap">
      <table className="table matrix">
        <caption className="visually-hidden">{caption}</caption>
        <thead><tr><th scope="col" className="corner">From ↓ / To →</th>{snapshot.states.map((s) => <th key={s.id} scope="col">{s.label}</th>)}<th scope="col" className="numeric">μ₀</th></tr></thead>
        <tbody>
          {snapshot.states.map((s, i) => (
            <tr key={s.id}>
              <th scope="row">{s.label}</th>
              {snapshot.P[i].map((p, j) => <td key={j} className="numeric">{formatProbability(p)}</td>)}
              <td className="numeric subtle">{formatProbability(snapshot.mu0[i] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
