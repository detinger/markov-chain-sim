import { ALL_EXAMPLES as EXAMPLES, EXAMPLE_META } from '../lib/examples';
import { Dialog } from './ui';
import { LESSON_BY_ID } from '../data/lessons';

function Preview({ k }: { k: string }) {
  const ex = EXAMPLES[k];
  const xs = ex.nodes.map((n) => n.x);
  const ys = ex.nodes.map((n) => n.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 60;
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad + 50} ${maxY - minY + 2 * pad + 50}`;
  const pos = new Map(ex.nodes.map((n) => [n.id, { x: n.x + 25, y: n.y + 25 }]));
  return (
    <svg className="example-preview" viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {ex.edges.filter((e) => e.source !== e.target).map((e) => {
        const a = pos.get(e.source)!; const b = pos.get(e.target)!;
        return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--border-strong)" strokeWidth={4} />;
      })}
      {ex.nodes.map((n) => {
        const p = pos.get(n.id)!;
        const absorbing = ex.edges.some((e) => e.source === n.id && e.target === n.id && e.probability === 1);
        return (
          <g key={n.id}>
            {absorbing && <circle cx={p.x} cy={p.y} r={38} fill="none" stroke="var(--markov-stroke)" strokeWidth={3} />}
            <circle cx={p.x} cy={p.y} r={30} fill="var(--markov-fill)" stroke="var(--markov-stroke)" strokeWidth={4} />
          </g>
        );
      })}
    </svg>
  );
}

export default function ExamplesDialog({ onOpen, onClose, onOpenLesson }: { onOpen: (key: string) => void; onClose: () => void; onOpenLesson?: (id: string) => void }) {
  return (
    <Dialog title="Examples" onClose={onClose}>
      <p className="muted">Opening an example replaces the current model. You can undo to get it back, or download it first.</p>
      {(['original', 'teaching'] as const).map((group) => (
        <section key={group} aria-labelledby={`ex-${group}`} style={{ marginTop: 12 }}>
          <h3 id={`ex-${group}`} style={{ marginBottom: 8 }}>{group === 'original' ? 'Story examples' : 'Small teaching examples'}</h3>
          <div className="card-grid">
            {Object.entries(EXAMPLES).filter(([key]) => (EXAMPLE_META[key]?.group ?? 'original') === group).map(([key, ex]) => {
              const meta = EXAMPLE_META[key];
              return (
                <article key={key} className="card example-card">
                  <Preview k={key} />
                  <div className="example-body">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <h4 style={{ margin: 0 }}>{ex.name}</h4>
                      <span className="badge">{meta?.difficulty}</span>
                    </div>
                    {meta?.subtitle && <span className="hint">{meta.subtitle}</span>}
                    <p>{meta?.description}</p>
                    <p className="hint">{ex.nodes.length} state{ex.nodes.length === 1 ? '' : 's'}{meta?.stepLabel ? ` · 1 step = 1 ${meta.stepLabel}` : ''}</p>
                    {meta?.goals?.length ? <p className="hint" style={{ margin: 0 }}><strong>Teaches:</strong> {meta.goals.join('; ')}</p> : null}
                    {meta?.assumptions.length ? (
                      <details><summary className="hint" style={{ cursor: 'pointer' }}>Assumptions and limits</summary>
                        <ul className="hint" style={{ margin: 0, paddingLeft: 16 }}>{meta.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
                      </details>
                    ) : null}
                    <div className="row" style={{ marginTop: 4 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => onOpen(key)} aria-label={`Open example ${ex.name}`}>Open example</button>
                      {meta?.lesson && onOpenLesson && <button className="btn btn-ghost btn-sm" onClick={() => onOpenLesson(meta.lesson!)}>Lesson: {LESSON_BY_ID[meta.lesson].title}</button>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </Dialog>
  );
}
