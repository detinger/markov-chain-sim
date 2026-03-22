import { useState, useMemo } from 'react';

export interface MarkovNode {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface MarkovEdge {
  id: string;
  source: string;
  target: string;
  probability: number;
  sourceHandle?: string;
  targetHandle?: string;
}

export function useMarkovModel() {
  const [nodes, setNodes] = useState<MarkovNode[]>([
    { id: '1', name: 'State A', x: 100, y: 100 },
    { id: '2', name: 'State B', x: 400, y: 100 }
  ]);
  const [edges, setEdges] = useState<MarkovEdge[]>([
    { id: 'e1-1', source: '1', target: '1', probability: 0.2 },
    { id: 'e1-2', source: '1', target: '2', probability: 0.8 },
    { id: 'e2-1', source: '2', target: '1', probability: 0.5 },
    { id: 'e2-2', source: '2', target: '2', probability: 0.5 },
  ]);

  const transitionMatrix = useMemo(() => {
    const matrix = Array(nodes.length).fill(0).map(() => Array(nodes.length).fill(0));
    const nodeIndexMap = new Map(nodes.map((n, i) => [n.id, i]));

    edges.forEach((edge) => {
      const srcIdx = nodeIndexMap.get(edge.source);
      const tgtIdx = nodeIndexMap.get(edge.target);
      if (srcIdx !== undefined && tgtIdx !== undefined) {
        matrix[srcIdx][tgtIdx] += edge.probability;
      }
    });

    return matrix;
  }, [nodes, edges]);

  const addNode = (node: MarkovNode) => setNodes(prev => [...prev, node]);
  const updateNode = (id: string, partial: Partial<MarkovNode>) => 
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...partial } : n));
  const removeNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.source !== id && e.target !== id));
  };

  const updateEdgeProbability = (source: string, target: string, probability: number) => {
    setEdges(prev => {
      const existing = prev.find(e => e.source === source && e.target === target);
      if (existing) {
        return prev.map(e => e.id === existing.id ? { ...e, probability } : e);
      } else {
        return [...prev, { id: `e${source}-${target}`, source, target, probability }];
      }
    });
  };

  const removeEdge = (id: string) => setEdges(prev => prev.filter(e => e.id !== id));

  return {
    nodes, edges, transitionMatrix,
    setNodes, setEdges,
    addNode, updateNode, removeNode,
    updateEdgeProbability, removeEdge,
    onNodesChange: setNodes,
    onEdgesChange: setEdges,
    onConnect: (source: string, target: string) => updateEdgeProbability(source, target, 0.5)
  };
}
