import type { ReactNode } from 'react';
import {
  ArrowRight, BarChart3, BookOpen, CheckCircle2, Download, FlaskConical, GitCompare, GraduationCap, HardDrive, Library, Network, Trash2, Trophy,
} from 'lucide-react';
import type { ChainDocumentV1 } from '../../domain/markov';
import { LESSONS } from '../../data/lessons';
import { CHALLENGES } from '../../data/challenges';
import type { Progress } from '../learning/progress';
import { BrandMark } from '../../components/ui';

export type HomeTarget = 'theory' | 'learn' | 'examples' | 'challenges' | 'modeler' | 'analysis' | 'experiments' | 'compare';

interface Props {
  doc: ChainDocumentV1;
  valid: boolean;
  progress: Progress;
  hasBaseline: boolean;
  onGo: (target: HomeTarget, lessonId?: string) => void;
  onDownloadModel: () => void;
  onClearAll: () => void;
}

interface Feature { id: HomeTarget; title: string; icon: ReactNode; summary: string; points: string[]; action: string }

const LEARN: Feature[] = [
  { id: 'theory', title: 'Theory', icon: <BookOpen />, action: 'Open quick reference',
    summary: 'A compact reference to the ideas used throughout the app.',
    points: ['Markov property, transition matrix, μₜ = μ₀Pᵗ', 'Classes, periodicity, stationary distributions', 'Absorption and hitting times'] },
  { id: 'learn', title: 'Lessons', icon: <GraduationCap />, action: 'Go to lessons',
    summary: `${LESSONS.length} short lessons in five levels, each with a worked model, a demo, a common mistake, and a check.`,
    points: ['Foundations → evolution → long-run behavior', 'Absorption and first passage', 'Monte Carlo experiments and comparisons'] },
  { id: 'examples', title: 'Examples', icon: <Library />, action: 'Browse examples',
    summary: 'Ready-made models to open in the modeler, with their assumptions and limits.',
    points: ['Weather, Casino Heist, Doomscroll Trap, SIR, and more', 'Six small teaching examples', 'Each links to a related lesson'] },
  { id: 'challenges', title: 'Challenges', icon: <Trophy />, action: 'Go to challenges',
    summary: `${CHALLENGES.length} exercises graded from exact calculations, with hints and explanations of common mistakes.`,
    points: ['Repair, build, and predict', 'Classify, compute outcomes, interpret uncertainty', 'Compare strategies under constraints'] },
];

const WORKSPACE: Feature[] = [
  { id: 'modeler', title: 'Modeler', icon: <Network />, action: 'Open the modeler',
    summary: 'Draw states and transitions, edit the matrix, and watch the chain evolve or simulate a seeded random path.',
    points: ['Validation with one-click repairs', 'Path probabilities and explanations', 'Undo/redo, import and export'] },
  { id: 'analysis', title: 'Analysis', icon: <BarChart3 />, action: 'Open analysis',
    summary: 'Exact long-run and first-passage results for your current model.',
    points: ['Communicating classes and periods', 'Stationary distributions and absorption', 'Hitting probabilities and times'] },
  { id: 'experiments', title: 'Experiments', icon: <FlaskConical />, action: 'Open experiments',
    summary: 'Run thousands of seeded trajectories and compare estimates with exact values.',
    points: ['95% intervals and censoring made explicit', 'Reproducible with a seed', 'Export CSV or a run bundle'] },
  { id: 'compare', title: 'Compare', icon: <GitCompare />, action: 'Open compare',
    summary: 'Freeze a baseline, change a copy, and compare exact results on shared definitions.',
    points: ['Every changed probability listed', 'Changes in percentage points', 'Parameter sweeps and a simulation check'] },
];

function FeatureCard({ f, onGo, extra }: { f: Feature; onGo: Props['onGo']; extra?: ReactNode }) {
  return (
    <article className="card home-card" aria-labelledby={`home-${f.id}`}>
      <div className="home-card-icon" aria-hidden>{f.icon}</div>
      <h3 id={`home-${f.id}`}>{f.title}</h3>
      <p className="muted">{f.summary}</p>
      <ul className="home-points">{f.points.map((p) => <li key={p}>{p}</li>)}</ul>
      {extra}
      <button className="btn btn-sm home-card-action" onClick={() => onGo(f.id)}>{f.action} <ArrowRight size={14} aria-hidden /></button>
    </article>
  );
}

export default function HomePage({ doc, valid, progress, hasBaseline, onGo, onDownloadModel, onClearAll }: Props) {
  const p = progress.progress;
  const lessonsDone = LESSONS.filter((l) => p.lessons[l.id]?.completedAt).length;
  const challengesDone = CHALLENGES.filter((c) => p.challenges[c.id]?.passedAt).length;
  const nextLesson = LESSONS.find((l) => !p.lessons[l.id]?.completedAt);
  const extras: Partial<Record<HomeTarget, ReactNode>> = {
    learn: <p className="hint home-status">{lessonsDone} of {LESSONS.length} completed</p>,
    challenges: <p className="hint home-status">{challengesDone} of {CHALLENGES.length} solved</p>,
    modeler: <p className="hint home-status">Current model: <strong>{doc.title || 'Untitled model'}</strong> · {doc.stateOrder.length} state{doc.stateOrder.length === 1 ? '' : 's'}{valid ? '' : ' · has issues'}</p>,
    compare: <p className="hint home-status">{hasBaseline ? 'A baseline is saved.' : 'No baseline yet.'}</p>,
  };

  return (
    <div className="page page-wide home">
      <header className="home-hero">
        <BrandMark />
        <div>
          <div className="eyebrow">Home</div>
          <h1>Markov Chain Simulator</h1>
          <p className="muted" style={{ maxWidth: '68ch' }}>
            Learn how discrete-time Markov chains behave, build your own, and check your intuition against exact calculations and simulations. Everything runs in your browser.
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => onGo('learn', nextLesson?.id)}>
              <GraduationCap size={16} aria-hidden /> {lessonsDone === 0 ? 'Start the first lesson' : nextLesson ? `Continue: ${nextLesson.title}` : 'Review lessons'}
            </button>
            <button className="btn" onClick={() => onGo('modeler')}><Network size={16} aria-hidden /> {doc.stateOrder.length ? 'Continue modeling' : 'Open the modeler'}</button>
            <button className="btn btn-ghost" onClick={() => onGo('examples')}><Library size={16} aria-hidden /> Open an example</button>
          </div>
        </div>
      </header>

      <section aria-labelledby="home-learn">
        <h2 id="home-learn" className="home-group">Learn</h2>
        <div className="home-grid">{LEARN.map((f) => <FeatureCard key={f.id} f={f} onGo={onGo} extra={extras[f.id]} />)}</div>
      </section>

      <section aria-labelledby="home-workspace">
        <h2 id="home-workspace" className="home-group">Workspace</h2>
        <div className="home-grid">{WORKSPACE.map((f) => <FeatureCard key={f.id} f={f} onGo={onGo} extra={extras[f.id]} />)}</div>
      </section>

      <section className="card home-data" aria-labelledby="home-data">
        <div className="home-card-icon" aria-hidden><HardDrive /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id="home-data" className="card-heading" style={{ marginTop: 0 }}>Your data</h2>
          <p className="muted" style={{ marginBottom: 8 }}>
            Your model, comparison baseline, learning progress, and preferences are saved only in this browser. Nothing is uploaded. Clearing your browser's site data also removes them.
          </p>
          <ul className="home-points">
            <li>Current model: {doc.title || 'Untitled model'}</li>
            <li>Comparison baseline: {hasBaseline ? 'saved' : 'none'}</li>
            <li>Learning progress: {lessonsDone} lesson{lessonsDone === 1 ? '' : 's'}, {challengesDone} challenge{challengesDone === 1 ? '' : 's'} {lessonsDone + challengesDone ? <CheckCircle2 size={12} aria-hidden /> : null}</li>
          </ul>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-sm" onClick={onDownloadModel}><Download size={14} aria-hidden /> Download current model</button>
            <button className="btn btn-sm btn-danger" onClick={onClearAll}><Trash2 size={14} aria-hidden /> Clear all data…</button>
          </div>
        </div>
      </section>
    </div>
  );
}
