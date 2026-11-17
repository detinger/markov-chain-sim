import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { applyCommand, compileChain, createEmptyDocument, importDocument, exportDocument, type Command } from '../domain/markov';
import type { ChainDocumentV1, CompiledChain } from '../domain/markov/types';
import { exampleToDocument } from '../lib/examples';

const AUTOSAVE_KEY = 'markov-simulator:autosave:v1';
const HISTORY_LIMIT = 200;

interface History {
  past: ChainDocumentV1[];
  present: ChainDocumentV1;
  future: ChainDocumentV1[];
  /** Consecutive commands with the same key merge into one undo step (typing, dragging). */
  lastKey?: string;
}

type Action =
  | { type: 'command'; command: Command; coalesceKey?: string }
  | { type: 'batch'; commands: Command[] }
  | { type: 'load'; document: ChainDocumentV1 }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'endCoalesce' };

function reducer(state: History, action: Action): History {
  switch (action.type) {
    case 'command':
    case 'batch': {
      const commands = action.type === 'command' ? [action.command] : action.commands;
      const next = commands.reduce(applyCommand, state.present);
      const key = action.type === 'command' ? action.coalesceKey : undefined;
      if (key && key === state.lastKey) return { ...state, present: next, future: [] };
      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: next, future: [], lastKey: key };
    }
    case 'load':
      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: action.document, future: [] };
    case 'undo':
      if (!state.past.length) return state;
      return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] };
    case 'redo':
      if (!state.future.length) return state;
      return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
    case 'endCoalesce':
      return state.lastKey ? { ...state, lastKey: undefined } : state;
  }
}

function initialDocument(): ChainDocumentV1 {
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      const r = importDocument(saved);
      if (r.ok) return r.document;
    }
  } catch { /* storage unavailable: fall through */ }
  return exampleToDocument('weather');
}

export type SaveStatus = 'saved' | 'saving' | 'failed';

export function useProject() {
  const [history, dispatchRaw] = useReducer(reducer, undefined, () => ({ past: [], present: initialDocument(), future: [] }));
  const doc = history.present;
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // Debounced autosave after committed changes (PLAN.md §7.6). Interim: localStorage; IndexedDB is planned.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaveStatus('saving');
    const t = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, exportDocument(doc));
        setSaveStatus('saved');
      } catch {
        setSaveStatus('failed');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [doc]);

  const dispatch = useCallback((command: Command, coalesceKey?: string) => dispatchRaw({ type: 'command', command, coalesceKey }), []);
  const batch = useCallback((commands: Command[]) => dispatchRaw({ type: 'batch', commands }), []);
  const load = useCallback((document: ChainDocumentV1) => dispatchRaw({ type: 'load', document }), []);
  const undo = useCallback(() => dispatchRaw({ type: 'undo' }), []);
  const redo = useCallback(() => dispatchRaw({ type: 'redo' }), []);
  const endCoalesce = useCallback(() => dispatchRaw({ type: 'endCoalesce' }), []);

  // Compile on every model change; keep the last valid snapshot so stale results can be labeled, not shown as current.
  const compiled = useMemo(() => compileChain(doc), [doc]);
  const lastValid = useRef<{ chain: CompiledChain; revision: number } | null>(null);
  if (compiled.status === 'ok') lastValid.current = { chain: compiled.result, revision: doc.modelRevision };

  return {
    doc,
    compiled,
    chain: compiled.status === 'ok' ? compiled.result : null,
    lastValidChain: lastValid.current,
    dispatch, batch, load, undo, redo, endCoalesce,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    saveStatus,
    newModel: () => load(createEmptyDocument()),
  };
}

export type Project = ReturnType<typeof useProject>;
