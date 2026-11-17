import { useCallback, useEffect, useState } from 'react';
import { CHALLENGE_BY_ID } from '../../data/challenges';
import { LESSON_BY_ID } from '../../data/lessons';

const KEY = 'markov-simulator:progress:v1';

export interface LearningProgress {
  schemaVersion: 1;
  lessons: Record<string, { version: number; completedAt?: string; checks: Record<string, { correct: boolean; attempts: number }> }>;
  challenges: Record<string, { version: number; attempts: number; hintsUsed: number; passedAt?: string }>;
  /** Entries dropped because their content version changed — shown once to the learner. */
  resetNotes?: string[];
}

const empty = (): LearningProgress => ({ schemaVersion: 1, lessons: {}, challenges: {} });

/** Load progress, discarding entries whose content version no longer matches (with an explanation). */
function load(): LearningProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw) as LearningProgress;
    if (p.schemaVersion !== 1) return empty();
    const notes: string[] = [];
    for (const [id, e] of Object.entries(p.lessons ?? {})) {
      const l = LESSON_BY_ID[id];
      if (!l || l.version !== e.version) { delete p.lessons[id]; if (l) notes.push(`Lesson “${l.title}” was updated; its progress was reset.`); }
    }
    for (const [id, e] of Object.entries(p.challenges ?? {})) {
      const c = CHALLENGE_BY_ID[id];
      if (!c || c.version !== e.version) { delete p.challenges[id]; if (c) notes.push(`Challenge “${c.title}” was updated; its progress was reset.`); }
    }
    return { ...empty(), ...p, resetNotes: notes.length ? notes : undefined };
  } catch {
    return empty();
  }
}

export function useProgress() {
  const [progress, setProgress] = useState<LearningProgress>(load);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ ...progress, resetNotes: undefined })); setSaveFailed(false); }
    catch { setSaveFailed(true); }
  }, [progress]);

  const recordCheck = useCallback((lessonId: string, checkId: string, correct: boolean) => setProgress((p) => {
    const l = p.lessons[lessonId] ?? { version: LESSON_BY_ID[lessonId].version, checks: {} };
    const prev = l.checks[checkId];
    return { ...p, lessons: { ...p.lessons, [lessonId]: { ...l, checks: { ...l.checks, [checkId]: { correct: correct || !!prev?.correct, attempts: (prev?.attempts ?? 0) + 1 } } } } };
  }), []);

  const completeLesson = useCallback((lessonId: string) => setProgress((p) => {
    const l = p.lessons[lessonId] ?? { version: LESSON_BY_ID[lessonId].version, checks: {} };
    return l.completedAt ? p : { ...p, lessons: { ...p.lessons, [lessonId]: { ...l, completedAt: new Date().toISOString() } } };
  }), []);

  const recordChallenge = useCallback((id: string, patch: { attempt?: boolean; passed?: boolean; hint?: number }) => setProgress((p) => {
    const c = p.challenges[id] ?? { version: CHALLENGE_BY_ID[id].version, attempts: 0, hintsUsed: 0 };
    return { ...p, challenges: { ...p.challenges, [id]: {
      ...c,
      attempts: c.attempts + (patch.attempt ? 1 : 0),
      hintsUsed: Math.max(c.hintsUsed, patch.hint ?? 0),
      passedAt: c.passedAt ?? (patch.passed ? new Date().toISOString() : undefined),
    } } };
  }), []);

  const reset = useCallback(() => setProgress(empty()), []);
  const dismissNotes = useCallback(() => setProgress((p) => ({ ...p, resetNotes: undefined })), []);
  const exportJson = useCallback(() => JSON.stringify({ format: 'markov-chain-simulator/learning-progress', ...progress, resetNotes: undefined }, null, 2), [progress]);

  return { progress, saveFailed, recordCheck, completeLesson, recordChallenge, reset, dismissNotes, exportJson };
}

export type Progress = ReturnType<typeof useProgress>;
