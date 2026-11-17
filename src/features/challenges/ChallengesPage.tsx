import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Lightbulb, Plus, RotateCcw, Target, Trash2, XCircle } from 'lucide-react';
import {
  assessChallenge, documentToSnapshot, parseAnswer, snapshotToDocument, suggestRoles,
  type AssessmentResult, type ChallengeDefinition,
} from '../../domain/assessment';
import { applyCommand, newId, validateDocument, type ChainDocumentV1, type Command, type StateId } from '../../domain/markov';
import { CHALLENGES, CHALLENGE_BY_ID } from '../../data/challenges';
import { LESSON_BY_ID } from '../../data/lessons';
import MatrixEditor, { InitialDistributionEditor } from '../../components/MatrixEditor';
import ValidationPanel from '../../components/ValidationPanel';
import type { Selection } from '../../app/selection';
import MiniChain, { SnapshotMatrix } from '../learning/MiniChain';
import { RunTable } from '../learning/ExperimentRuns';
import type { Progress } from '../learning/progress';

interface Props {
  challengeId: string | null;
  onSelect: (id: string | null) => void;
  onOpenLesson: (id: string) => void;
  progress: Progress;
}

export default function ChallengesPage({ challengeId, onSelect, onOpenLesson, progress }: Props) {
  const def = challengeId ? CHALLENGE_BY_ID[challengeId] : null;
  return (
    <div className="page page-wide">
      {def ? (
        <ChallengeView key={def.id} def={def} onBack={() => onSelect(null)} onOpenLesson={onOpenLesson} progress={progress} />
      ) : (
        <>
          <header className="page-header">
            <div>
              <div className="eyebrow">Challenges</div>
              <h1>Practice with feedback</h1>
              <p className="muted" style={{ maxWidth: '72ch' }}>Each challenge is checked from exact calculations on your model or answer — never from one lucky random run or from where you put the states. Hints are free and always available.</p>
            </div>
          </header>
          <div className="card-grid">
            {[...CHALLENGES].sort((a, b) => a.level - b.level).map((c) => {
              const p = progress.progress.challenges[c.id];
              return (
                <button key={c.id} className="card linked-card challenge-card" onClick={() => onSelect(c.id)}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="badge">Level {c.level}</span>
                    {p?.passedAt ? <span className="badge badge-success"><CheckCircle2 size={12} aria-hidden /> Solved</span> : p?.attempts ? <span className="badge badge-outline">{p.attempts} attempt{p.attempts > 1 ? 's' : ''}</span> : null}
                  </div>
                  <h3 style={{ margin: '10px 0 4px' }}>{c.title}</h3>
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>{c.objective}</p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ChallengeView({ def, onBack, onOpenLesson, progress }: { def: ChallengeDefinition; onBack: () => void; onOpenLesson: (id: string) => void; progress: Progress }) {
  const [doc, setDoc] = useState<ChainDocumentV1>(() => snapshotToDocument(def.starter));
  const [selection, setSelection] = useState<Selection>(null);
  const [roleMap, setRoleMap] = useState<Record<string, StateId>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const saved = progress.progress.challenges[def.id];
  const [hintsShown, setHintsShown] = useState(saved?.hintsUsed ?? 0);
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dispatch = (c: Command) => {
    // Fixed rows are read-only in the UI; also ignore repairs that would touch them.
    const row = 'from' in c ? c.from : 'stateId' in c && c.type !== 'setInitial' && c.type !== 'setSingleStart' ? c.stateId : null;
    if (row && def.lockedRows?.includes(row)) return;
    setDoc((d) => applyCommand(d, c)); setResult(null);
  };
  const snapshot = useMemo(() => documentToSnapshot(doc), [doc]);
  const issues = useMemo(() => validateDocument(doc), [doc]);

  // Suggest role mappings from labels; never override an explicit choice that is still valid.
  useEffect(() => {
    if (!def.roles) return;
    const suggested = suggestRoles(def.roles, snapshot);
    setRoleMap((m) => {
      const next = { ...m };
      for (const r of def.roles!) if (!next[r] || !doc.stateOrder.includes(next[r])) { if (suggested[r]) next[r] = suggested[r]; else delete next[r]; }
      return next;
    });
  }, [snapshot, def.roles, doc.stateOrder]);

  const check = () => {
    const r = assessChallenge(def, { snapshot, roleMap, answers });
    setResult(r);
    progress.recordChallenge(def.id, { attempt: true, passed: r.passed });
  };
  const reset = () => { setDoc(snapshotToDocument(def.starter)); setAnswers({}); setResult(null); setSelection(null); };
  const label = (id: StateId) => doc.states.find((s) => s.id === id)?.label || 'Unnamed';
  const answerAssertions = def.assertions.filter((a) => a.kind === 'numeric-answer' || a.kind === 'choice-answer' || a.kind === 'state-set');
  const setAnswer = (key: string, v: string) => { setAnswers((x) => ({ ...x, [key]: v })); setResult(null); };

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 12 }}><ArrowLeft size={14} /> All challenges</button>
      <header className="page-header">
        <div>
          <div className="eyebrow">Challenge · Level {def.level}</div>
          <h1>{def.title}</h1>
          <p className="row hint" style={{ gap: 6 }}><Target size={14} aria-hidden /> {def.objective}</p>
        </div>
        <div className="row">
          {saved?.passedAt && <span className="badge badge-success"><CheckCircle2 size={12} aria-hidden /> Solved before</span>}
          <button className="btn btn-sm" onClick={reset}><RotateCcw size={14} /> Reset challenge</button>
        </div>
      </header>

      <div className="challenge-layout">
        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <h3>Scenario</h3>
            <div className="prose">{def.scenario.map((p, i) => <p key={i}>{p}</p>)}</div>
            <p className="hint" style={{ margin: 0 }}>Background: {def.prerequisites.map((id) => (
              <button key={id} className="link-button" onClick={() => onOpenLesson(id)}>{LESSON_BY_ID[id].title}</button>
            ))}</p>
          </section>

          {def.mode === 'model' ? (
            <section className="card">
              <h3>Your model</h3>
              <MiniChain snapshot={snapshot} height={220} />
              {def.allowStructureEdits && (
                <div className="section">
                  <div className="section-head"><h4>States</h4>
                    <button className="btn btn-sm" onClick={() => dispatch({ type: 'addState', id: newId('s'), label: `State ${doc.stateOrder.length + 1}`, x: doc.stateOrder.length * 220, y: 0 })}><Plus size={14} /> Add state</button>
                  </div>
                  {doc.stateOrder.length === 0 && <p className="hint">Add a state for each kind of situation in the scenario.</p>}
                  <div className="stack">
                    {doc.stateOrder.map((id) => (
                      <div key={id} className="row" style={{ flexWrap: 'nowrap' }}>
                        <label className="visually-hidden" htmlFor={`name-${id}`}>State name</label>
                        <input id={`name-${id}`} className="input input-sm" style={{ flex: 1 }} defaultValue={label(id)}
                          onBlur={(e) => e.target.value.trim() && e.target.value !== label(id) && dispatch({ type: 'renameState', id, label: e.target.value.trim() })}
                          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
                        <button className="btn btn-sm btn-icon btn-danger" aria-label={`Delete ${label(id)}`} onClick={() => dispatch({ type: 'deleteState', id })}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {doc.stateOrder.length > 0 && (
                <>
                  <div className="section"><h4>Transition matrix</h4><MatrixEditor doc={doc} selection={selection} onSelect={setSelection} dispatch={dispatch} cellRefs={cellRefs} lockedRows={def.lockedRows} />{def.lockedRows?.length ? <p className="hint">Shaded rows are fixed in this exercise.</p> : null}</div>
                  {!def.roles && !def.lockedRows && <div className="section"><h4>Starting distribution μ₀</h4><InitialDistributionEditor doc={doc} dispatch={dispatch} /></div>}
                  <details open={issues.some((i) => i.severity === 'error')}>
                    <summary className="hint" style={{ cursor: 'pointer' }}>Validate ({issues.filter((i) => i.severity === 'error').length} issues)</summary>
                    <div style={{ marginTop: 8 }}><ValidationPanel issues={issues} dispatch={dispatch} onFocusIssue={(s) => setSelection(s)} /></div>
                  </details>
                </>
              )}
              {def.roles && doc.stateOrder.length > 0 && (
                <div className="section" style={{ marginTop: 12 }}>
                  <h4>Which of your states means…</h4>
                  <p className="hint">The checker compares meanings, not names or order.</p>
                  <div className="field-row">
                    {def.roles.map((r) => (
                      <label key={r} className="field"><span className="field-label">{r}</span>
                        <select className="select input-sm" value={roleMap[r] ?? ''} onChange={(e) => { setRoleMap((m) => ({ ...m, [r]: e.target.value })); setResult(null); }}>
                          <option value="">Choose a state…</option>
                          {doc.stateOrder.map((id) => <option key={id} value={id}>{label(id)}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="card">
              <h3>The model</h3>
              <MiniChain snapshot={def.starter} height={220} />
              <SnapshotMatrix snapshot={def.starter} caption="Read-only model for this challenge" />
              {def.experiment && (
                <div className="section" style={{ marginTop: 12 }}>
                  <h4>Simulation results (fixed seeds)</h4>
                  <RunTable snapshot={def.starter} horizon={def.experiment.horizon} state={def.experiment.state} runs={def.experiment.runs} />
                </div>
              )}
              <div className="section" style={{ marginTop: 16 }}>
                <h4>Your answers</h4>
                {answerAssertions.map((a) => {
                  if (a.kind === 'numeric-answer') return (
                    <label key={a.key} className="field"><span className="field-label">{a.label}</span>
                      <input className="input num" style={{ maxWidth: 220 }} value={answers[a.key] ?? ''} placeholder="e.g. 0.25, 25%, 1/4" inputMode="decimal"
                        aria-invalid={(answers[a.key] ?? '') !== '' && parseAnswer(answers[a.key]) === null ? true : undefined}
                        onChange={(e) => setAnswer(a.key, e.target.value)} />
                    </label>
                  );
                  if (a.kind === 'choice-answer') return (
                    <fieldset key={a.key} className="field choice-group">
                      <legend className="field-label">{a.question}</legend>
                      {a.choices.map((c, i) => (
                        <label key={i} className="choice">
                          <input type="radio" name={`${def.id}-${a.key}`} checked={answers[a.key] === String(i)} onChange={() => setAnswer(a.key, String(i))} /> {c}
                        </label>
                      ))}
                    </fieldset>
                  );
                  if (a.kind === 'state-set') {
                    const chosen = (answers[a.key] ?? '').split(',').filter(Boolean);
                    return (
                      <fieldset key={a.key} className="field">
                        <legend className="field-label">{a.label} — tick every state that belongs</legend>
                        <div className="state-pick">
                          {def.starter.states.map((st) => (
                            <label key={st.id} className={`filter-chip${chosen.includes(st.id) ? ' selected' : ''}`}>
                              <input type="checkbox" checked={chosen.includes(st.id)} onChange={(e) => setAnswer(a.key, (e.target.checked ? [...chosen, st.id] : chosen.filter((x) => x !== st.id)).join(','))} />
                              {st.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    );
                  }
                  return null;
                })}
              </div>
            </section>
          )}
        </div>

        <aside className="stack challenge-side" style={{ gap: 16 }}>
          <section className="card">
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={check}><CheckCircle2 size={16} /> Check answer</button>
            {result && <FeedbackPanel result={result} rubric={def.rubric} />}
          </section>
          <section className="card" aria-labelledby="hints-h">
            <h3 id="hints-h" className="row" style={{ gap: 6 }}><Lightbulb size={16} aria-hidden /> Hints</h3>
            <ol className="hints">
              {def.hints.slice(0, hintsShown).map((h, i) => <li key={i}>{h}</li>)}
            </ol>
            {hintsShown < def.hints.length ? (
              <button className="btn btn-sm" onClick={() => { const n = hintsShown + 1; setHintsShown(n); progress.recordChallenge(def.id, { hint: n }); }}>
                Show hint {hintsShown + 1} of {def.hints.length}
              </button>
            ) : <p className="hint">All hints shown.</p>}
            <p className="hint" style={{ marginTop: 8 }}>Using hints is recorded for your own reference only; it never blocks the challenge.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function FeedbackPanel({ result, rubric }: { result: AssessmentResult; rubric: string }) {
  return (
    <div className="feedback" role="status" aria-live="polite">
      <div className={`callout ${result.passed ? 'callout-success' : 'callout-error'}`} style={{ marginTop: 12 }}>
        {result.passed ? <CheckCircle2 /> : <XCircle />}
        <p><strong>{result.passed ? 'Solved!' : 'Not yet.'}</strong> {result.passed ? `Key idea: ${rubric}` : `${result.needsAttention.length} thing${result.needsAttention.length > 1 ? 's' : ''} to fix.`}</p>
      </div>
      {result.correct.length > 0 && (
        <div className="feedback-part"><h4>What is correct</h4><ul>{result.correct.map((c) => <li key={c}>{c}</li>)}</ul></div>
      )}
      {result.needsAttention.length > 0 && (
        <div className="feedback-part"><h4>What needs attention and why</h4>
          <ul>{result.needsAttention.map((n) => <li key={n.message}><strong>{n.message}</strong> {n.why}</li>)}</ul>
        </div>
      )}
      <div className="feedback-part"><h4>Rubric</h4>
        <ul className="rubric">{result.results.map((r) => (
          <li key={r.criterion} className={r.passed ? 'ok' : 'bad'}>{r.passed ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}<span>{r.criterion}<span className="visually-hidden">{r.passed ? ': met' : ': not yet met'}</span></span></li>
        ))}</ul>
      </div>
      <div className="feedback-part"><h4>Next</h4><p style={{ margin: 0 }}>{result.next}</p></div>
    </div>
  );
}
