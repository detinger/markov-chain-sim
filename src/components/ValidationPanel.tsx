import { AlertCircle, AlertTriangle, BookOpen, CheckCircle2, Info, Lightbulb } from 'lucide-react';
import type { Command, RepairKind, ValidationIssue } from '../domain/markov';
import type { Selection } from '../app/selection';

const ICONS = { error: AlertCircle, warning: AlertTriangle, recommendation: Lightbulb, info: Info } as const;
const SEVERITY_LABEL = { error: 'Error', warning: 'Warning', recommendation: 'Recommendation', info: 'Information' } as const;
const REPAIR_LABEL: Record<RepairKind, string> = {
  'normalize-row': 'Normalize row',
  'make-absorbing': 'Make absorbing',
  'distribute-equally': 'Distribute equally',
  'normalize-initial': 'Normalize starting distribution',
};

export default function ValidationPanel({ issues, onFocusIssue, dispatch, lessonLink }: {
  issues: ValidationIssue[];
  onFocusIssue: (s: Selection, tab: 'matrix') => void;
  dispatch: (c: Command) => void;
  /** Contextual lesson for an issue code, if any. */
  lessonLink?: (code: string) => { title: string; open: () => void } | null;
}) {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const order = { error: 0, warning: 1, recommendation: 2, info: 3 };
  const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity]);

  const repair = (issue: ValidationIssue, r: RepairKind) => {
    const t = issue.target;
    if (r === 'normalize-initial') return dispatch({ type: 'normalizeInitial' });
    if (t.kind !== 'row') return;
    if (r === 'normalize-row') dispatch({ type: 'normalizeRow', stateId: t.stateId });
    if (r === 'make-absorbing') dispatch({ type: 'makeAbsorbing', stateId: t.stateId });
    if (r === 'distribute-equally') dispatch({ type: 'distributeEqually', stateId: t.stateId });
  };

  return (
    <div className="stack">
      {errors === 0 ? (
        <div className="callout callout-success"><CheckCircle2 /><p>The model is valid: every row and the starting distribution total 1. Calculations are up to date.{issues.length ? ' The notes below describe properties of the chain; they are not errors.' : ''}</p></div>
      ) : (
        <div className="callout callout-error"><AlertCircle /><p>{errors} issue{errors > 1 ? 's' : ''} block new calculations. You can keep editing and saving; nothing is discarded.</p></div>
      )}
      {sorted.map((issue, i) => {
        const Icon = ICONS[issue.severity];
        const focusable = issue.target.kind === 'row' || issue.target.kind === 'cell';
        return (
          <div key={`${issue.code}-${i}`} className={`issue issue-${issue.severity}`}>
            <div className="issue-title">
              <Icon size={16} aria-hidden style={{ color: `var(--${issue.severity})` }} />
              <span className="visually-hidden">{SEVERITY_LABEL[issue.severity]}:</span>
              {issue.title}
            </div>
            <p className="issue-body">{issue.explanation}</p>
            <div className="issue-actions">
              {focusable && (
                <button className="btn btn-sm" onClick={() => {
                  const t = issue.target;
                  if (t.kind === 'row') onFocusIssue({ kind: 'state', id: t.stateId }, 'matrix');
                  if (t.kind === 'cell') onFocusIssue({ kind: 'transition', from: t.from, to: t.to }, 'matrix');
                }}>Show in matrix</button>
              )}
              {(() => {
                const l = lessonLink?.(issue.code);
                return l ? <button className="btn btn-sm btn-ghost" onClick={l.open}><BookOpen size={14} aria-hidden /> Learn: {l.title}</button> : null;
              })()}
              {issue.repairs?.map((r) => (
                <button key={r} className="btn btn-sm" onClick={() => repair(issue, r)} title="Undoable">{REPAIR_LABEL[r]}</button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
