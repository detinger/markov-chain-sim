import { useCallback, useEffect, useState } from 'react';
import { CHALLENGE_BY_ID } from '../../data/challenges';
import { LESSON_BY_ID } from '../../data/lessons';
import { isClearingData } from '../../app/clearData';
import { emptyProgress, migrateProgress, type LearningProgress } from './migrateProgress';

const KEY = 'markov-simulator:progress:v1';
const BACKUP_KEY = 'markov-simulator:progress:backup';

export type { LearningProgress };

const lessonVersions = Object.fromEntries(Object.values(LESSON_BY_ID).map((l) => [l.id, {
  title: l.title, version: l.version, progressCompatibleFrom: l.progressCompatibleFrom,
  checkIds: l.sections.flatMap((x) => ('id' in x ? [x.id] : [])),
}]));
const challengeVersions = Object.fromEntries(Object.values(CHALLENGE_BY_ID).map((c) => [c.id, { title: c.title, version: c.version, progressCompatibleFrom: c.progressCompatibleFrom }]));

/** Load and migrate progress. Unreadable data is backed up before it can be overwritten. */
function load(): LearningProgress {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { return emptyProgress(); }
  let parsed: unknown = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = '<invalid JSON>'; }
  const r = migrateProgress(parsed, lessonVersions, challengeVersions);
  if (r.status === 'unreadable' && raw) { try { localStorage.setItem(BACKUP_KEY, raw); } catch { /* ignore */ } }
  return r.progress;
}

export function useProgress() {
  const [progress, setProgress] = useState<LearningProgress>(load);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (isClearingData()) return;
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

  const reset = useCallback(() => setProgress(emptyProgress()), []);
  const dismissNotes = useCallback(() => setProgress((p) => ({ ...p, resetNotes: undefined })), []);
  const exportJson = useCallback(() => JSON.stringify({ format: 'markov-chain-simulator/learning-progress', ...progress, resetNotes: undefined }, null, 2), [progress]);

  return { progress, saveFailed, recordCheck, completeLesson, recordChallenge, reset, dismissNotes, exportJson };
}

export type Progress = ReturnType<typeof useProgress>;
