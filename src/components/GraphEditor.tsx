import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  applyNodeChanges,
  useNodesInitialized,
  useReactFlow,
  MarkerType,
  type NodeChange,
  type Connection,
  type Node,
  type Edge as RfEdge,
  type ColorMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ArcEdge from './ArcEdge';
import CircleNode, { type StateNodeData } from './CircleNode';
import { formatProbability, type ChainDocumentV1, type Command, type StateId } from '../domain/markov';
import { stateColorVar } from './ui';
import type { Selection } from '../app/selection';

const nodeTypes = { circle: CircleNode };

/** Re-fit the viewport when a different project is opened or the canvas is resized by a panel toggle. */
function FitOnProjectChange({ projectId }: { projectId: string }) {
  const { fitView } = useReactFlow();
  const ready = useNodesInitialized();
  useEffect(() => {
    if (!ready) return;
    // Wait for React Flow to measure the new canvas size before fitting.
    const t = setTimeout(() => fitView({ padding: 0.25, maxZoom: 1 }), 60);
    return () => clearTimeout(t);
  }, [projectId, ready, fitView]);
  return null;
}
const edgeTypes = { arc: ArcEdge };

interface GraphEditorProps {
  doc: ChainDocumentV1;
  colorMode: ColorMode;
  selection: Selection;
  draft: { from: StateId; to: StateId } | null;
  flags: { absorbing: Set<StateId>; invalid: Set<StateId>; unreachable: Set<StateId> };
  onSelect: (s: Selection) => void;
  dispatch: (c: Command, coalesceKey?: string) => void;
  onConnectPair: (from: StateId, to: StateId) => void;
  /** Sample-trajectory overlay; travelMs = 0 means highlight only (reduced motion). */
  sim?: { stateId: StateId; edge: { from: StateId; to: StateId } | null; key: string; travelMs: number } | null;
  /** Changes when the canvas is resized by a layout toggle (e.g. hiding the inspector), to re-fit the view. */
  layoutKey?: string;
}

export default function GraphEditor({ doc, colorMode, selection, draft, flags, onSelect, dispatch, onConnectPair, sim, layoutKey }: GraphEditorProps) {
  const initialByState = useMemo(() => new Map(doc.initial.map((e) => [e.stateId, e.probability])), [doc.initial]);
  const colorIndex = useMemo(() => new Map(doc.states.map((s, i) => [s.id, i])), [doc.states]);

  const buildNodes = useCallback((): Node<StateNodeData>[] =>
    doc.stateOrder.map((id) => {
      const s = doc.states.find((x) => x.id === id)!;
      const pos = doc.layout.positions[id] ?? { x: 0, y: 0 };
      const mass = initialByState.get(id) ?? 0;
      return {
        id,
        type: 'circle',
        position: pos,
        selected: selection?.kind === 'state' && selection.id === id,
        deletable: false,
        ariaLabel: `State ${s.label}`,
        data: {
          label: s.label,
          isStart: mass > 0,
          startMass: Number(formatProbability(mass, 2)) || mass,
          absorbing: flags.absorbing.has(id),
          invalid: flags.invalid.has(id),
          unreachable: flags.unreachable.has(id),
          color: doc.layout.colors?.[id] ?? stateColorVar(colorIndex.get(id) ?? 0),
          active: sim?.stateId === id,
          onRename: (label: string) => dispatch({ type: 'renameState', id, label }),
        },
      };
    }), [doc, selection, flags, initialByState, colorIndex, dispatch, sim?.stateId]);

  // Local node state keeps drags smooth; the document is updated once on drag stop (one undo step).
  const [nodes, setNodes] = useState<Node<StateNodeData>[]>(buildNodes);
  useEffect(() => setNodes(buildNodes()), [buildNodes]);

  const labelOf = (id: StateId) => doc.states.find((s) => s.id === id)?.label ?? id;

  const edges: RfEdge[] = useMemo(() => {
    const list: RfEdge[] = doc.transitions
      .filter((t) => t.probability > 0)
      .map((t) => {
        const isSel = selection?.kind === 'transition' && selection.from === t.from && selection.to === t.to;
        const isSim = !!sim?.edge && sim.edge.from === t.from && sim.edge.to === t.to;
        const color = isSim ? 'var(--markov-active)' : isSel ? 'var(--markov-selected)' : 'var(--markov-stroke)';
        return {
          id: `${t.from}->${t.to}`,
          source: t.from,
          target: t.to,
          type: 'arc',
          selected: isSel,
          label: formatProbability(t.probability, 2),
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color },
          data: {
            active: isSim,
            token: isSim && sim!.travelMs > 0 ? { key: sim!.key, duration: sim!.travelMs } : null,
            onSelect: () => onSelect({ kind: 'transition', from: t.from, to: t.to }),
            description: `Transition ${labelOf(t.from)} to ${labelOf(t.to)}, probability ${t.probability}`,
          },
        };
      });
    if (draft && !doc.transitions.some((t) => t.from === draft.from && t.to === draft.to && t.probability > 0)) {
      list.push({
        id: `${draft.from}->${draft.to}`,
        source: draft.from,
        target: draft.to,
        type: 'arc',
        className: 'draft',
        selected: true,
        label: 'set p',
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'var(--text-subtle)' },
        data: { draft: true, onSelect: () => onSelect({ kind: 'transition', from: draft.from, to: draft.to }), description: 'Draft transition awaiting a probability' },
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.transitions, doc.states, selection, draft, onSelect, sim]);

  const handleNodesChange = useCallback((changes: NodeChange<Node<StateNodeData>>[]) => {
    setNodes((ns) => applyNodeChanges(changes.filter((c) => c.type !== 'remove'), ns));
  }, []);

  const handleConnect = useCallback((params: Connection) => {
    if (params.source && params.target) onConnectPair(params.source, params.target);
  }, [onConnectPair]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      colorMode={colorMode}
      onNodesChange={handleNodesChange}
      onNodeDragStop={(_, __, dragged) => {
        const key = `drag-${Date.now()}`;
        dragged.forEach((n) => dispatch({ type: 'moveState', id: n.id, x: n.position.x, y: n.position.y }, key));
      }}
      onNodeClick={(_, n) => onSelect({ kind: 'state', id: n.id })}
      onEdgeClick={(_, e) => onSelect({ kind: 'transition', from: e.source, to: e.target })}
      onPaneClick={() => onSelect(null)}
      onConnect={handleConnect}
      connectionRadius={48}
      deleteKeyCode={null}
      fitView
      fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
      minZoom={0.2}
      proOptions={{ hideAttribution: false }}
      aria-label="Chain graph. Use the inspector to add transitions by keyboard."
    >
      <Controls showInteractive={false} />
      <FitOnProjectChange projectId={`${doc.id}|${layoutKey ?? ''}`} />
    </ReactFlow>
  );
}
