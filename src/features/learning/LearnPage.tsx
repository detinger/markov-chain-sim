import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Clock, Download, Lightbulb, Network, RotateCcw, Target, XCircle } from 'lucide-react';
import { Dialog } from '../../components/ui';
import { evaluateTarget, parseAnswer, snapshotToDocument, type ModelSnapshot } from '../../domain/assessment';
import { compileChain, evolveDistribution, formatProbability } from '../../domain/markov';
import { CHALLENGE_BY_ID } from '../../data/challenges';
import { LESSONS, LESSON_BY_ID, LEVELS, type Lesson, type LessonSection } from '../../data/lessons';
import SequenceCalculator from '../../components/SequenceCalculator';
import MiniChain, { SnapshotMatrix } from './MiniChain';
import type { Progress } from './progress';

interface Props {
  lessonId: string;
  onSelectLesson: (id: string) => void;
  onOpenChallenge: (id: string) => void;
  onOpenInModeler: (snapshot: ModelSnapshot) => void;
  progress: Progress;
}

export default function LearnPage({ lessonId, onSelectLesson, onOpenChallenge, onOpenInModeler, progress }: Props) {
  const lesson = LESSON_BY_ID[lessonId] ?? LESSONS[0];
  const p = progress.progress;
  const [confirmReset, setConfirmReset] = useState(false);
  const done = Object.values(p.lessons).filter((l) => l.completedAt).length;
  const exportProgress = () => {
    const url = URL.createObjectURL(new Blob([progress.exportJson()], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: 'markov-learning-progress.json' }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="page page-wide">
      <header className="page-header">
        <div>
          <div className="eyebrow">Lessons</div>
          <h1>Learn Markov chains step by step</h1>
          <p className="muted" style={{ maxWidth: '72ch' }}>Short lessons with a worked model, an interactive demonstration, a common mistake, and a quick check. Nothing is locked — explore in any order. Your modeler work is not changed unless you choose “Open in modeler”.</p>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end' }}>
          <div className="progress" style={{ width: 200 }} role="progressbar" aria-label="Lessons completed" aria-valuemin={0} aria-valuemax={LESSONS.length} aria-valuenow={done}>
            <div className="progress-fill" style={{ width: `${(done / LESSONS.length) * 100}%` }} />
          </div>
          <span className="hint">{done} of {LESSONS.length} lessons complete · saved on this device{progress.saveFailed ? ' (save failed — export to keep it)' : ''}</span>
          <div className="row">
            <button className="btn btn-sm btn-ghost" onClick={exportProgress}><Download size={14} /> Export progress</button>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirmReset(true)}><RotateCcw size={14} /> Reset progress</button>
          </div>
        </div>
      </header>
      {confirmReset && (
        <Dialog size="sm" title="Reset learning progress?" onClose={() => setConfirmReset(false)} footer={<>
          <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
          <button className="btn" onClick={exportProgress}><Download size={14} /> Export first</button>
          <button className="btn btn-danger" onClick={() => { progress.reset(); setConfirmReset(false); }}>Reset progress</button>
        </>}>
          <p>This clears completed lessons, check attempts, challenge attempts, and hints used on this device. Your models are not affected. This cannot be undone.</p>
        </Dialog>
      )}
      {p.resetNotes && (
        <div className="callout" style={{ marginBottom: 16 }}><AlertTriangle /><div><p>{p.resetNotes.join(' ')}</p><button className="btn btn-sm" onClick={progress.dismissNotes}>Dismiss</button></div></div>
      )}
      <div className="reference-layout">
        <nav className="lesson-index card" aria-label="Lessons">
          {Object.entries(LEVELS).map(([lvl, info]) => (
            <div key={lvl} className="lesson-level">
              <div className="nav-group" style={{ padding: '0 0 4px' }}>Level {lvl} · {info.title}</div>
              <ul>
                {LESSONS.filter((l) => l.level === Number(lvl)).map((l) => {
                  const done = !!p.lessons[l.id]?.completedAt;
                  return (
                    <li key={l.id}>
                      <button className="lesson-link" aria-current={l.id === lesson.id ? 'page' : undefined} onClick={() => onSelectLesson(l.id)}>
                        {done ? <CheckCircle2 size={14} className="done" aria-label="Completed" /> : <span className="dot" aria-hidden />}
                        <span>{l.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="hint" style={{ margin: '0 0 8px' }}>Goal: {info.outcome}</p>
            </div>
          ))}
        </nav>
        <LessonArticle key={lesson.id} lesson={lesson} progress={progress} onSelectLesson={onSelectLesson} onOpenChallenge={onOpenChallenge} onOpenInModeler={onOpenInModeler} />
      </div>
    </div>
  );
}

function LessonArticle({ lesson, progress, onSelectLesson, onOpenChallenge, onOpenInModeler }: Omit<Props, 'lessonId'> & { lesson: Lesson }) {
  const checks = lesson.sections.filter((s) => s.kind === 'check' || s.kind === 'numeric-check') as Extract<LessonSection, { id: string }>[];
  const state = progress.progress.lessons[lesson.id];
  const allCorrect = checks.every((c) => state?.checks[c.id]?.correct);
  const done = !!state?.completedAt;
  const next = lesson.next ? LESSON_BY_ID[lesson.next] : null;

  return (
    <article className="lesson-article" aria-labelledby="lesson-title">
      <div className="eyebrow">Level {lesson.level} · {LEVELS[lesson.level].title}</div>
      <h2 id="lesson-title" style={{ fontSize: 26 }}>{lesson.title}</h2>
      <div className="row hint" style={{ marginBottom: 12 }}>
        <span className="row" style={{ gap: 4 }}><Target size={14} aria-hidden /> {lesson.objective}</span>
        <span className="row" style={{ gap: 4 }}><Clock size={14} aria-hidden /> About {lesson.minutes} min</span>
        {lesson.prerequisites.length > 0 && <span>Builds on: {lesson.prerequisites.map((id) => (
          <button key={id} className="link-button" onClick={() => onSelectLesson(id)}>{LESSON_BY_ID[id].title}</button>
        ))}</span>}
      </div>

      {lesson.sections.map((s, i) => <Section key={i} section={s} lesson={lesson} progress={progress} onOpenChallenge={onOpenChallenge} onOpenInModeler={onOpenInModeler} />)}

      <div className="lesson-footer">
        {done ? (
          <div className="callout callout-success"><CheckCircle2 /><p>Lesson complete.</p></div>
        ) : allCorrect ? (
          <button className="btn btn-primary" onClick={() => progress.completeLesson(lesson.id)}><CheckCircle2 size={16} /> Mark lesson complete</button>
        ) : (
          <p className="hint">Answer the check{checks.length > 1 ? 's' : ''} above to complete this lesson.</p>
        )}
        {next && <button className="btn" onClick={() => onSelectLesson(next.id)}>Next: {next.title} <ArrowRight size={16} /></button>}
      </div>
    </article>
  );
}

function Section({ section: s, lesson, progress, onOpenChallenge, onOpenInModeler }: { section: LessonSection; lesson: Lesson; progress: Progress; onOpenChallenge: (id: string) => void; onOpenInModeler: (s: ModelSnapshot) => void }) {
  switch (s.kind) {
    case 'text':
      return <section className="lesson-section">{s.heading && <h3>{s.heading}</h3>}{s.body.map((b, i) => <p key={i}>{b}</p>)}</section>;
    case 'formula':
      return <div className="formula lesson-section" role="math" aria-label={s.spoken}>{s.text}</div>;
    case 'model':
      return (
        <figure className="lesson-section lesson-figure">
          <MiniChain snapshot={s.snapshot} />
          <figcaption>
            <strong>{s.caption}</strong> <span className="muted">{s.description}</span>
            <details style={{ marginTop: 6 }}><summary className="hint" style={{ cursor: 'pointer' }}>Show the matrix</summary><SnapshotMatrix snapshot={s.snapshot} caption={s.description} /></details>
            <button className="btn btn-sm btn-ghost" style={{ marginTop: 6 }} onClick={() => onOpenInModeler(s.snapshot)}><Network size={14} /> Open in modeler</button>
          </figcaption>
        </figure>
      );
    case 'demo-evolve':
      return <EvolveDemo snapshot={s.snapshot} caption={s.caption} maxT={s.maxT} />;
    case 'demo-path':
      return <PathDemo snapshot={s.snapshot} caption={s.caption} />;
    case 'mistake':
      return <div className="callout callout-warning lesson-section"><AlertTriangle /><p><strong>Common mistake.</strong> {s.text}</p></div>;
    case 'check':
      return <ChoiceCheck section={s} lesson={lesson} progress={progress} />;
    case 'numeric-check':
      return <NumericCheck section={s} lesson={lesson} progress={progress} />;
    case 'try': {
      const c = CHALLENGE_BY_ID[s.challengeId];
      const passed = !!progress.progress.challenges[s.challengeId]?.passedAt;
      return (
        <div className="callout lesson-section"><Lightbulb /><div className="row" style={{ justifyContent: 'space-between', flex: 1 }}>
          <p style={{ margin: 0 }}><strong>Try it:</strong> {s.text}</p>
          <button className="btn btn-sm" onClick={() => onOpenChallenge(s.challengeId)}>{passed ? <CheckCircle2 size={14} /> : null} {c.title}</button>
        </div></div>
      );
    }
  }
}

function useCompiled(snapshot: ModelSnapshot) {
  return useMemo(() => {
    const doc = snapshotToDocument(snapshot);
    const c = compileChain(doc);
    return { doc, chain: c.status === 'ok' ? c.result : null };
  }, [snapshot]);
}

function EvolveDemo({ snapshot, caption, maxT }: { snapshot: ModelSnapshot; caption: string; maxT: number }) {
  const { chain } = useCompiled(snapshot);
  const [t, setT] = useState(0);
  const series = useMemo(() => {
    if (!chain) return null;
    const e = evolveDistribution(chain, maxT);
    return e.status === 'ok' ? e.result : null;
  }, [chain, maxT]);
  if (!series) return null;
  const top = snapshot.states[series[t].indexOf(Math.max(...series[t]))]?.id;
  return (
    <section className="lesson-section card demo">
      <div className="row" style={{ justifyContent: 'space-between' }}><strong>Interactive: {caption}</strong><span className="badge badge-primary">Exact</span></div>
      <div className="demo-grid">
        <MiniChain snapshot={snapshot} height={200} highlight={top} />
        <div>
          <label className="field"><span className="field-label">Step t = <span className="num">{t}</span>{snapshot.stepLabel ? ` (${snapshot.stepLabel}s)` : ''}</span>
            <input type="range" min={0} max={maxT} value={t} onChange={(e) => setT(Number(e.target.value))} aria-label="Step" />
          </label>
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">Distribution at step {t}</caption>
              <thead><tr><th scope="col">State</th><th scope="col" className="numeric">μₜ</th><th scope="col">Share</th></tr></thead>
              <tbody>{snapshot.states.map((st, i) => (
                <tr key={st.id}><td>{st.label}</td><td className="numeric">{formatProbability(series[t][i])}</td>
                  <td style={{ width: '40%' }}><div className="progress" aria-hidden><div className="progress-fill" style={{ width: `${series[t][i] * 100}%` }} /></div></td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function PathDemo({ snapshot, caption }: { snapshot: ModelSnapshot; caption: string }) {
  const { doc, chain } = useCompiled(snapshot);
  return (
    <section className="lesson-section card demo">
      <strong>Interactive: {caption}</strong>
      <div className="demo-grid" style={{ marginTop: 8 }}>
        <MiniChain snapshot={snapshot} height={200} />
        <SequenceCalculator doc={doc} chain={chain} />
      </div>
    </section>
  );
}

function Feedback({ correct, explanation }: { correct: boolean; explanation: string }) {
  return (
    <div className={`callout ${correct ? 'callout-success' : 'callout-error'}`} style={{ marginTop: 8 }} role="status">
      {correct ? <CheckCircle2 /> : <XCircle />}
      <p><strong>{correct ? 'Correct.' : 'Not quite.'}</strong> {correct ? explanation : 'Try again, or read the explanation after another attempt.'}</p>
    </div>
  );
}

function ChoiceCheck({ section: s, lesson, progress }: { section: Extract<LessonSection, { kind: 'check' }>; lesson: Lesson; progress: Progress }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const attempts = progress.progress.lessons[lesson.id]?.checks[s.id]?.attempts ?? 0;
  return (
    <fieldset className="lesson-section card check">
      <legend className="check-legend"><BookOpen size={14} aria-hidden /> Check: {s.question}</legend>
      {s.choices.map((c, i) => (
        <label key={i} className={`choice${choice === i ? ' selected' : ''}`}>
          <input type="radio" name={`${lesson.id}-${s.id}`} checked={choice === i} onChange={() => { setChoice(i); setResult(null); }} /> {c}
        </label>
      ))}
      <button className="btn btn-sm btn-primary" disabled={choice === null} onClick={() => { const ok = choice === s.correct; setResult(ok); progress.recordCheck(lesson.id, s.id, ok); }}>Check answer</button>
      {result !== null && <Feedback correct={result} explanation={s.explanation} />}
      {result === false && attempts >= 2 && <p className="hint" style={{ marginTop: 6 }}>Explanation: {s.explanation}</p>}
    </fieldset>
  );
}

function NumericCheck({ section: s, lesson, progress }: { section: Extract<LessonSection, { kind: 'numeric-check' }>; lesson: Lesson; progress: Progress }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<boolean | null>(null);
  const attempts = progress.progress.lessons[lesson.id]?.checks[s.id]?.attempts ?? 0;
  const parsed = parseAnswer(text);
  return (
    <div className="lesson-section card check">
      <label className="check-legend" htmlFor={`${lesson.id}-${s.id}`}><BookOpen size={14} aria-hidden /> Check: {s.question}</label>
      <div className="row">
        <input id={`${lesson.id}-${s.id}`} className="input num" style={{ width: 160 }} value={text} placeholder="e.g. 0.25, 25%, 1/4" inputMode="decimal"
          aria-invalid={text !== '' && parsed === null ? true : undefined} onChange={(e) => { setText(e.target.value); setResult(null); }} />
        <button className="btn btn-sm btn-primary" disabled={parsed === null} onClick={() => {
          const exact = evaluateTarget(s.snapshot, s.target);
          const ok = exact !== null && parsed !== null && Math.abs(parsed - exact) <= s.tolerance;
          setResult(ok); progress.recordCheck(lesson.id, s.id, ok);
        }}>Check answer</button>
      </div>
      {text !== '' && parsed === null && <p className="hint" style={{ color: 'var(--error)', marginTop: 4 }}>Enter a number such as 0.25, 25%, or 1/4.</p>}
      {result !== null && <Feedback correct={result} explanation={s.explanation} />}
      {result === false && attempts >= 2 && <p className="hint" style={{ marginTop: 6 }}>Worked solution: {s.explanation}</p>}
    </div>
  );
}
