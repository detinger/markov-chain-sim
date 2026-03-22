import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Connection,
  Node,
  Edge as RfEdge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { MarkovNode, MarkovEdge } from '../hooks/useMarkovModel';
import ArcEdge from './ArcEdge';
import CircleNode from './CircleNode';

const nodeTypes = {
  circle: CircleNode,
};

const edgeTypes = {
  arc: ArcEdge,
};

interface GraphEditorProps {
  nodes: MarkovNode[];
  edges: MarkovEdge[];
  onNodesChange: (nodes: MarkovNode[]) => void;
  onEdgesChange: (edges: MarkovEdge[]) => void;
  onConnect: (source: string, target: string) => void;
  onNodeRename: (id: string, newName: string) => void;
}

export default function GraphEditor({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeRename }: GraphEditorProps) {
  const nodeStatesRef = useRef<Record<string, any>>({});
  const edgeStatesRef = useRef<Record<string, any>>({});

  const rfNodes: Node[] = nodes.map(n => ({
    ...nodeStatesRef.current[n.id],
    id: n.id,
    position: { x: n.x, y: n.y },
    data: { label: n.name, onRename: (newName: string) => onNodeRename(n.id, newName) },
    type: 'circle',
  }));

  const rfEdges: RfEdge[] = edges.map(e => ({
    ...edgeStatesRef.current[e.id],
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.probability.toFixed(2),
    type: 'arc',
    markerEnd: { type: 'arrowclosed', width: 12, height: 12, color: 'var(--accent)' },
    style: { stroke: 'var(--accent)', strokeWidth: 1.5, opacity: 0.8 },
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
  }));

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const updated = applyNodeChanges(changes, rfNodes);
    
    updated.forEach(n => {
      const { id, position, data, type, ...rest } = n;
      nodeStatesRef.current[id] = rest;
    });

    onNodesChange(updated.map((n: any) => ({
      id: n.id,
      name: n.data.label,
      x: n.position.x,
      y: n.position.y
    })));
  }, [rfNodes, onNodesChange]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const updated = applyEdgeChanges(changes, rfEdges);
    
    updated.forEach(e => {
      const { id, source, target, label, type, markerEnd, style, sourceHandle, targetHandle, ...rest } = e as any;
      edgeStatesRef.current[id] = rest;
    });

    // Reflect removals back to the parent state
    const currentEdgeIds = new Set(updated.map(e => e.id));
    const newEdges = edges.filter(e => currentEdgeIds.has(e.id));
    if (newEdges.length !== edges.length) {
      onEdgesChange(newEdges);
    }
  }, [rfEdges, edges, onEdgesChange]);

  const handleConnect = useCallback((params: Connection) => {
    if (params.source && params.target) {
      onConnect(params.source, params.target);
    }
  }, [onConnect]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        fitView
      >
        <Controls />
      </ReactFlow>
    </div>
  );
}
