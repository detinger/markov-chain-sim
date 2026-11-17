import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, BookOpen, CheckCircle2, ChevronsLeft, ChevronsRight, Cloud, CloudOff, Download, FilePlus2,
  Grid3x3, Info, Library, ListChecks, Loader2, Monitor, Moon, Network, Plus, Redo2, Route, Sun, Undo2, Upload,
} from 'lucide-react';
import GraphEditor from './components/GraphEditor';
import MatrixEditor, { InitialDistributionEditor } from './components/MatrixEditor';
import DistributionPanel from './components/SimulationChart';
import SequenceCalculator from './components/SequenceCalculator';
import TheoryModal from './components/TheoryModal';
import ExamplesDialog from './components/ExamplesDialog';
import ValidationPanel from './components/ValidationPanel';
import StateInspector from './components/StateInspector';
import ExplainPanel from './components/ExplainPanel';
import { BrandMark, Dialog, Tabs, Toasts, type Toast } from './components/ui';
import { useProject } from './app/useProject';
import { useTheme, type ThemePreference } from './app/theme';
import type { Selection } from './app/selection';
import {
  classifyChain, createEmptyDocument, deletionImpact, exportDocument, importDocument, newId, rowOf, validateDocument,
  type ChainDocumentV1, type StateId,
} from './domain/markov';
import { exampleToDocument } from './lib/examples';

type InspectorTab = 'matrix' | 'state' | 'validate' | 'sequence' | 'explain';
type Pending = { kind: 'replace'; title: string; next: () => ChainDocumentV1 } | { kind: 'delete'; id: StateId } | null;

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fileName = (doc: ChainDocumentV1) => `${(doc.title || 'markov-model').replace(/[^\w-]+/g, '-').toLowerCase()}.markov.json`;

export default function App() {
  const project = useProject();
  const { doc, chain, lastValidChain, dispatch, load, undo, redo } = project;
  const { preference, resolved, setPreference } = useTheme();
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [tab, setTab] = useState<InspectorTab>('matrix');
  const [selection, setSelection] = useState<Selection>(null);
  const [dialog, setDialog] = useState<'theory' | 'examples' | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  // Drop selections that point at deleted states.
  useEffect(() => {
    if (!selection) return;
    const ids = new Set(doc.stateOrder);
    if ((selection.kind === 'state' && !ids.has(selection.id)) || (selection.kind === 'transition' && (!ids.has(selection.from) || !ids.has(selection.to)))) setSelection(null);
  }, [doc.stateOrder, selection]);

  const issues = useMemo(() => validateDocument(doc), [doc]);
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const analysisChain = chain ?? lastValidChain?.chain ?? null;
  const stale = !chain && !!lastValidChain && doc.stateOrder.length > 0;
  const structure = useMemo(() => {
    if (!chain) return null;
    const s = classifyChain(chain);
    return s.status === 'ok' ? s.result : null;
  }, [chain]);

  const flags = useMemo(() => {
    const invalid = new Set(issues.flatMap((i) => (i.severity === 'error' && i.target.kind === 'row' ? [i.target.stateId] : [])));
    const absorbing = new Set<StateId>();
    const unreachable = new Set<StateId>();
    if (structure && chain) {
      structure.absorbing.forEach((i) => absorbing.add(chain.stateIds[i]));
      structure.reachableFromInitial.forEach((r, i) => !r && unreachable.add(chain.stateIds[i]));
    }
    return { invalid, absorbing, unreachable };
  }, [issues, structure, chain]);

  // A selected transition with zero probability is a draft edge awaiting a value (PLAN.md Module A).
  const draft = useMemo(() => {
    if (selection?.kind !== 'transition') return null;
    const p = rowOf(doc, selection.from)[doc.stateOrder.indexOf(selection.to)] ?? 0;
    return p === 0 ? { from: selection.from, to: selection.to } : null;
  }, [selection, doc]);

  const select = useCallback((s: Selection, focusTab?: InspectorTab) => {
    setSelection(s);
    if (focusTab) setTab(focusTab);
  }, []);

  const onGraphSelect = useCallback((s: Selection) => {
    setSelection(s);
    if (!s) return;
    setTab((current) => {
      if (current === 'matrix' && s.kind === 'transition') {
        requestAnimationFrame(() => cellRefs.current[`${s.from}->${s.to}`]?.focus());
        return current;
      }
      return current === 'sequence' || current === 'explain' ? current : 'state';
    });
  }, []);

  const onConnectPair = useCallback((from: StateId, to: StateId) => {
    setSelection({ kind: 'transition', from, to });
    setTab('state');
  }, []);

  const addState = () => {
    const n = doc.stateOrder.length;
    const id = newId('s');
    const used = new Set(doc.states.map((s) => s.label));
    let k = n + 1;
    while (used.has(`State ${k}`)) k++;
    dispatch({ type: 'addState', id, label: `State ${k}`, x: 80 + (n % 4) * 190 + (Math.floor(n / 4) % 2) * 60, y: 80 + Math.floor(n / 4) * 170 });
    setSelection({ kind: 'state', id });
    setTab('state');
  };

  const replaceProject = (title: string, next: () => ChainDocumentV1) => {
    if (doc.stateOrder.length === 0) { load(next()); setSelection(null); return; }
    setPending({ kind: 'replace', title, next });
  };

  const onImport = async (file: File) => {
    const text = await file.text();
    const r = importDocument(text);
    if (!r.ok) { toast('error', `Could not import ${file.name}: ${r.errors.join(' ')}`); return; }
    replaceProject(`Import “${r.document.title}”`, () => r.document);
  };

  // Undo/redo shortcuts, never while typing (STYLE.md §15.1).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const SaveIcon = project.saveStatus === 'failed' ? CloudOff : project.saveStatus === 'saving' ? Loader2 : Cloud;
  const themeOptions: { v: ThemePreference; icon: JSX.Element; label: string }[] = [
    { v: 'light', icon: <Sun size={14} />, label: 'Light theme' },
    { v: 'dark', icon: <Moon size={14} />, label: 'Dark theme' },
    { v: 'system', icon: <Monitor size={14} />, label: 'Match system theme' },
  ];

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="shell">
        <nav className={`nav${navCollapsed ? ' collapsed' : ''}`} aria-label="Main">
          <div className="brand" aria-label="Markov Chain Simulator">
            <BrandMark />
            <div className="brand-text">
              <div className="brand-name">Markov Chain Simulator</div>
              <div className="brand-tag">Model · Simulate · Understand</div>
            </div>
          </div>
          <div className="nav-group">Workspace</div>
          <button className="nav-link" aria-current="page" title="Modeler"><Network /><span className="nav-text">Modeler</span><span className="visually-hidden">Modeler</span></button>
          <div className="nav-group">Learn</div>
          <button className="nav-link" onClick={() => setDialog('examples')} title="Examples"><Library /><span className="nav-text">Examples</span><span className="visually-hidden">Examples</span></button>
          <button className="nav-link" onClick={() => setDialog('theory')} title="Theory"><BookOpen /><span className="nav-text">Theory</span><span className="visually-hidden">Theory</span></button>
          <div className="nav-spacer" />
          <div className="nav-theme">
            <div className="segmented" role="group" aria-label="Theme">
              {themeOptions.map((o) => (
                <button key={o.v} className="btn btn-sm btn-icon" aria-pressed={preference === o.v} aria-label={o.label} title={o.label} onClick={() => setPreference(o.v)}>{o.icon}</button>
              ))}
            </div>
          </div>
          {navCollapsed && (
            <button className="nav-link" onClick={() => setPreference(resolved === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`} title="Toggle theme">
              {resolved === 'dark' ? <Sun /> : <Moon />}
            </button>
          )}
          <button className="nav-link nav-collapse" onClick={() => setNavCollapsed(!navCollapsed)} aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!navCollapsed}>
            {navCollapsed ? <ChevronsRight /> : <ChevronsLeft />}<span className="nav-text">Collapse</span>
          </button>
        </nav>

        <div className="main">
          <header className="toolbar">
            <div className="toolbar-group" style={{ minWidth: 0 }}>
              <label htmlFor="model-title" className="visually-hidden">Model name</label>
              <input id="model-title" className="input title-input" key={doc.id} defaultValue={doc.title} style={{ width: `${Math.min(40, Math.max(14, doc.title.length + 3))}ch` }}
                onBlur={(e) => e.target.value !== doc.title && dispatch({ type: 'setTitle', title: e.target.value || 'Untitled model' })}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
              <span className={`save-status${project.saveStatus === 'failed' ? ' failed' : ''}`} role="status" aria-live="polite">
                <SaveIcon size={14} aria-hidden />
                {project.saveStatus === 'saved' ? 'Saved on this device' : project.saveStatus === 'saving' ? 'Saving…' : 'Save failed — download a project file to keep your edits'}
              </span>
            </div>
            <span className="toolbar-spacer" />
            <div className="toolbar-group">
              <button className="btn btn-icon btn-ghost" onClick={undo} disabled={!project.canUndo} aria-label="Undo" title="Undo (Ctrl/⌘+Z)"><Undo2 size={16} /></button>
              <button className="btn btn-icon btn-ghost" onClick={redo} disabled={!project.canRedo} aria-label="Redo" title="Redo (Ctrl/⌘+Shift+Z)"><Redo2 size={16} /></button>
            </div>
            <span className="toolbar-sep" aria-hidden />
            <div className="toolbar-group">
              <button className="btn btn-primary" onClick={addState}><Plus size={16} /> Add State</button>
              <button className="btn" onClick={() => replaceProject('New Model', () => createEmptyDocument())}><FilePlus2 size={16} /> New Model</button>
            </div>
            <span className="toolbar-sep" aria-hidden />
            <div className="toolbar-group">
              <button className="btn btn-ghost" onClick={() => fileInput.current?.click()} title="Import a project file"><Upload size={16} /> Import</button>
              <button className="btn btn-ghost" onClick={() => { download(fileName(doc), exportDocument(doc)); toast('success', 'Project file downloaded.'); }} title="Download project file"><Download size={16} /> Export</button>
              <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
            </div>
          </header>

          <main id="main" className="workspace" tabIndex={-1}>
            <div className="canvas-column">
              <div className="canvas">
                {doc.stateOrder.length > 0 && (
                  <div className="canvas-hint" aria-hidden>Drag a state’s center to another state to connect · drag its edge to move · double-click to rename</div>
                )}
                <GraphEditor
                  doc={doc}
                  colorMode={resolved}
                  selection={selection}
                  draft={draft}
                  flags={flags}
                  onSelect={onGraphSelect}
                  dispatch={dispatch}
                  onConnectPair={onConnectPair}
                />
                {doc.stateOrder.length === 0 && (
                  <div className="canvas-empty">
                    <div className="card">
                      <h3>Empty model</h3>
                      <p className="muted">Create your first state, or open an example to explore a working model. The first state starts with probability 1 and a self-loop of 1.</p>
                      <div className="row" style={{ justifyContent: 'center' }}>
                        <button className="btn btn-primary" onClick={addState}><Plus size={16} /> Add State</button>
                        <button className="btn" onClick={() => setDialog('examples')}><Library size={16} /> Open an example</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="status-strip" aria-label="Model status">
                <span>{doc.stateOrder.length} states</span>
                <span>{doc.transitions.filter((t) => t.probability > 0).length} transitions</span>
                {errorCount === 0
                  ? <span className="ok"><CheckCircle2 size={12} aria-hidden /> Valid</span>
                  : <button className="btn btn-ghost btn-sm bad" onClick={() => setTab('validate')}><AlertCircle size={12} aria-hidden /> {errorCount} issue{errorCount > 1 ? 's' : ''}</button>}
                {doc.metadata.stepLabel && <span>1 step = 1 {doc.metadata.stepLabel}</span>}
                <span className="subtle">revision {doc.modelRevision}</span>
              </div>
              <DistributionPanel doc={doc} chain={analysisChain} stale={stale} theme={resolved} />
            </div>

            <aside className="inspector" aria-label="Inspector">
              <Tabs<InspectorTab>
                label="Inspector"
                idPrefix="insp"
                active={tab}
                onChange={setTab}
                tabs={[
                  { id: 'matrix', label: 'Matrix', icon: <Grid3x3 size={14} /> },
                  { id: 'state', label: 'State', icon: <Info size={14} /> },
                  { id: 'validate', label: 'Validate', icon: <ListChecks size={14} />, badge: errorCount ? <span className="badge badge-error">{errorCount}</span> : undefined },
                  { id: 'sequence', label: 'Sequence', icon: <Route size={14} /> },
                  { id: 'explain', label: 'Explain', icon: <BookOpen size={14} /> },
                ]}
              />
              <div className="inspector-body" role="tabpanel" id={`insp-panel-${tab}`} aria-labelledby={`insp-tab-${tab}`}>
                {tab === 'matrix' && (
                  <>
                    <div className="section">
                      <div className="section-head"><h3>Transition Matrix</h3></div>
                      <MatrixEditor doc={doc} selection={selection} onSelect={setSelection} dispatch={dispatch} cellRefs={cellRefs} />
                    </div>
                    <div className="section">
                      <div className="section-head"><h3>Starting distribution μ₀</h3></div>
                      <InitialDistributionEditor key={doc.id} doc={doc} dispatch={dispatch} />
                    </div>
                  </>
                )}
                {tab === 'state' && (
                  <StateInspector doc={doc} selection={selection} structure={structure} dispatch={dispatch} onSelect={(s) => setSelection(s)}
                    onRequestDelete={(id) => setPending({ kind: 'delete', id })} onClearDraft={() => {}} />
                )}
                {tab === 'validate' && <ValidationPanel issues={issues} dispatch={dispatch} onFocusIssue={(s, t) => {
                  select(s, t);
                  if (s?.kind === 'state') requestAnimationFrame(() => cellRefs.current[`${s.id}->${doc.stateOrder[0]}`]?.focus());
                  if (s?.kind === 'transition') requestAnimationFrame(() => cellRefs.current[`${s.from}->${s.to}`]?.focus());
                }} />}
                {tab === 'sequence' && (
                  <>
                    <div className="section-head"><h3>Sequence Probability Calculator</h3></div>
                    <SequenceCalculator doc={doc} chain={chain} />
                  </>
                )}
                {tab === 'explain' && <ExplainPanel doc={doc} chain={analysisChain} stale={stale} />}
              </div>
            </aside>
          </main>
        </div>
      </div>

      {dialog === 'theory' && <TheoryModal onClose={() => setDialog(null)} />}
      {dialog === 'examples' && (
        <ExamplesDialog onClose={() => setDialog(null)} onOpen={(key) => { setDialog(null); replaceProject(`Open “${exampleToDocument(key).title}”`, () => exampleToDocument(key)); }} />
      )}

      {pending?.kind === 'replace' && (
        <Dialog size="sm" title={`${pending.title}?`} onClose={() => setPending(null)} footer={
          <>
            <button className="btn" onClick={() => setPending(null)}>Cancel</button>
            <button className="btn" onClick={() => { download(fileName(doc), exportDocument(doc)); load(pending.next()); setSelection(null); setPending(null); }}><Download size={16} /> Download, then continue</button>
            <button className="btn btn-primary" onClick={() => { load(pending.next()); setSelection(null); setPending(null); toast('info', 'Previous model replaced. Press Undo to restore it.'); }}>Replace current model</button>
          </>
        }>
          <p>This replaces “{doc.title}” ({doc.stateOrder.length} states) in the workspace. You can press <strong>Undo</strong> to restore it during this session, or download a project file to keep a copy.</p>
        </Dialog>
      )}
      {pending?.kind === 'delete' && (() => {
        const impact = deletionImpact(doc, pending.id);
        const name = doc.states.find((s) => s.id === pending.id)?.label ?? 'this state';
        const rowNames = impact.rows.map((r) => doc.states.find((s) => s.id === r)?.label ?? r);
        return (
          <Dialog size="sm" title={`Delete “${name}”?`} onClose={() => setPending(null)} footer={
            <>
              <button className="btn" onClick={() => setPending(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { dispatch({ type: 'deleteState', id: pending.id }); setPending(null); if (impact.rows.length || impact.initialMass > 0) setTab('validate'); }}>Delete state</button>
            </>
          }>
            <p>This removes {name}, its row and column, and every transition into or out of it. Undo restores it.</p>
            {rowNames.length > 0 && <div className="callout callout-warning"><AlertCircle /><p>Rows that lose probability and will need repair: <strong>{rowNames.join(', ')}</strong>. Nothing is redistributed automatically.</p></div>}
            {impact.initialMass > 0 && <div className="callout callout-warning" style={{ marginTop: 8 }}><AlertCircle /><p>The starting distribution loses {impact.initialMass} and will need a new starting state.</p></div>}
          </Dialog>
        );
      })()}

      <Toasts toasts={toasts} />
    </>
  );
}
