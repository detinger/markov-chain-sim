// Pure progress migration (PLAN.md Phase 6). No React, no storage: tested in isolation.

export interface LessonProgress { version: number; completedAt?: string; checks: Record<string, { correct: boolean; attempts: number }> }
export interface ChallengeProgress { version: number; attempts: number; hintsUsed: number; passedAt?: string }

export interface LearningProgress {
  schemaVersion: 1;
  lessons: Record<string, LessonProgress>;
  challenges: Record<string, ChallengeProgress>;
  /** Explanations shown once to the learner after a reset or migration. */
  resetNotes?: string[];
}

export interface ContentVersion { title: string; version: number; progressCompatibleFrom?: number; checkIds?: string[] }

export const emptyProgress = (): LearningProgress => ({ schemaVersion: 1, lessons: {}, challenges: {} });

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const count = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
const date = (x: unknown) => (typeof x === 'string' && !Number.isNaN(Date.parse(x)) ? x : undefined);

/** Same version → keep; older but ≥ progressCompatibleFrom → keep and upgrade; otherwise reset. */
function compatible(saved: number, c: ContentVersion): 'same' | 'upgrade' | 'reset' {
  if (saved === c.version) return 'same';
  return saved < c.version && saved >= (c.progressCompatibleFrom ?? c.version) ? 'upgrade' : 'reset';
}

export type MigrationOutcome =
  | { status: 'ok'; progress: LearningProgress }
  /** Stored data could not be used; the caller should back it up before overwriting. */
  | { status: 'unreadable'; progress: LearningProgress; reason: string };

export function migrateProgress(raw: unknown, lessons: Record<string, ContentVersion>, challenges: Record<string, ContentVersion>): MigrationOutcome {
  if (raw === null || raw === undefined) return { status: 'ok', progress: emptyProgress() };
  if (!isObj(raw)) return { status: 'unreadable', progress: { ...emptyProgress(), resetNotes: ['Saved progress could not be read and was set aside; you are starting fresh.'] }, reason: 'not an object' };
  if (raw.schemaVersion !== 1) {
    return { status: 'unreadable', reason: `schema ${String(raw.schemaVersion)}`,
      progress: { ...emptyProgress(), resetNotes: ['Saved progress was written by a different version of the app and was set aside (a backup is kept on this device).'] } };
  }
  const notes: string[] = [];
  const out = emptyProgress();

  for (const [id, e] of Object.entries(isObj(raw.lessons) ? raw.lessons : {})) {
    const l = lessons[id];
    if (!l || !isObj(e)) continue; // content removed: drop silently
    const c = compatible(count(e.version), l);
    if (c === 'reset') { notes.push(`Lesson “${l.title}” was updated; its progress was reset.`); continue; }
    const checks: LessonProgress['checks'] = {};
    for (const [cid, ce] of Object.entries(isObj(e.checks) ? e.checks : {})) {
      if (l.checkIds && !l.checkIds.includes(cid)) continue; // question removed
      if (isObj(ce)) checks[cid] = { correct: ce.correct === true, attempts: count(ce.attempts) };
    }
    out.lessons[id] = { version: l.version, checks, ...(date(e.completedAt) ? { completedAt: date(e.completedAt) } : {}) };
  }

  for (const [id, e] of Object.entries(isObj(raw.challenges) ? raw.challenges : {})) {
    const ch = challenges[id];
    if (!ch || !isObj(e)) continue;
    const c = compatible(count(e.version), ch);
    if (c === 'reset') { notes.push(`Challenge “${ch.title}” was updated; its progress was reset.`); continue; }
    out.challenges[id] = { version: ch.version, attempts: count(e.attempts), hintsUsed: count(e.hintsUsed), ...(date(e.passedAt) ? { passedAt: date(e.passedAt) } : {}) };
  }
  return { status: 'ok', progress: notes.length ? { ...out, resetNotes: notes } : out };
}
