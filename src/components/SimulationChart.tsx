import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MarkovNode } from '../hooks/useMarkovModel';

export default function SimulationChart({ history, nodes }: { history: number[][], nodes: MarkovNode[] }) {
  const data = history.map((dist, step) => {
    const point: any = { step };
    nodes.forEach((n, i) => { point[n.name] = dist[i]; });
    return point;
  });

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  return (
    <div style={{ width: '100%', height: 300, background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>State Probability Distribution</h3>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="step" stroke="#cbd5e1" />
          <YAxis domain={[0, 1]} stroke="#cbd5e1" />
          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#f8fafc' }} />
          <Legend />
          {nodes.map((n, i) => (
            <Line key={n.id} type="monotone" dataKey={n.name} stroke={colors[i % colors.length]} strokeWidth={3} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
