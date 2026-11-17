import { useCallback, useState } from 'react';
import { exportDocument, importDocument, type ChainDocumentV1 } from '../../domain/markov';

const KEY = 'markov-simulator:baseline:v1';

/** An immutable baseline snapshot (PLAN.md Module F). It is never edited — only replaced or discarded. */
export interface BaselineRecord {
  schemaVersion: 1;
  savedAt: string;
  document: ChainDocumentV1;
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o as Record<string, unknown>).forEach(deepFreeze);
  }
  return o;
}

function load(): BaselineRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { schemaVersion?: number; savedAt?: string; document?: unknown };
    if (parsed.schemaVersion !== 1 || typeof parsed.savedAt !== 'string') return null;
    // Re-validate through the document importer rather than trusting stored JSON.
    const r = importDocument(JSON.stringify(parsed.document));
    return r.ok ? deepFreeze({ schemaVersion: 1, savedAt: parsed.savedAt, document: r.document }) : null;
  } catch {
    return null;
  }
}

export function useBaseline() {
  const [baseline, setState] = useState<BaselineRecord | null>(load);
  const [storageFailed, setStorageFailed] = useState(false);

  const setBaseline = useCallback((doc: ChainDocumentV1) => {
    // Round-trip through the exporter: a structural copy that shares nothing with the live project.
    const copy = importDocument(exportDocument(doc));
    if (!copy.ok) return;
    const record = deepFreeze<BaselineRecord>({ schemaVersion: 1, savedAt: new Date().toISOString(), document: copy.document });
    setState(record);
    try { localStorage.setItem(KEY, JSON.stringify(record)); setStorageFailed(false); } catch { setStorageFailed(true); }
  }, []);

  const clear = useCallback(() => {
    setState(null);
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }, []);

  return { baseline, setBaseline, clear, storageFailed };
}

export type Baseline = ReturnType<typeof useBaseline>;
