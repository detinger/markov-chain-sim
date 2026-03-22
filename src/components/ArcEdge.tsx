import { BaseEdge, EdgeLabelRenderer, EdgeProps, useInternalNode } from '@xyflow/react';

export default function ArcEdge({
  source,
  target,
  style = {},
  markerEnd,
  label
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  // Center coordinate logic
  const sourceCenterX = (sourceNode.internals.positionAbsolute?.x ?? 0) + (sourceNode.measured.width ?? 0) / 2;
  const sourceCenterY = (sourceNode.internals.positionAbsolute?.y ?? 0) + (sourceNode.measured.height ?? 0) / 2;
  const targetCenterX = (targetNode.internals.positionAbsolute?.x ?? 0) + (targetNode.measured.width ?? 0) / 2;
  const targetCenterY = (targetNode.internals.positionAbsolute?.y ?? 0) + (targetNode.measured.height ?? 0) / 2;

  let path = '';
  let labelX = 0;
  let labelY = 0;

  if (source === target) {
    // Dynamic self-loop logic (always on top of the node)
    const r = 30;
    const radius = 50;
    const startX = sourceCenterX;
    const startY = sourceCenterY - radius;
    path = `M ${startX} ${startY} C ${startX - r * 2.5} ${startY - r * 4}, ${startX + r * 2.5} ${startY - r * 4}, ${startX} ${startY}`;
    labelX = startX;
    labelY = startY - r * 3 + 10;
  } else {
    // Direction vector
    const dx = targetCenterX - sourceCenterX;
    const dy = targetCenterY - sourceCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);

    // Perpendicular vector for label positioning
    const px = -ny;
    const py = nx;

    // Radius of circular nodes
    const radius = 50;

    // To prevent A->B and B->A from crossing or overlapping at the start/end points, 
    // we DRAW them from the pure intersection of the center-line, but then we 
    // force a SWEEP bulge. A->B bulge right, B->A bulge right (which is left from A's perspective).
    const sx = sourceCenterX + nx * radius;
    const sy = sourceCenterY + ny * radius;
    const tx = targetCenterX - nx * radius;
    const ty = targetCenterY - ny * radius;

    const arcLen = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2);
    // Control curviness: Larger multiplier = flatter line. 
    // 1.2 provides a nice, clean arc that isn't too extreme.
    const curviness = arcLen * 1.5;

    // Fixed sweep 1 for both. Since the line direction is flipped (Source/Target), 
    // they will bulge in opposite ways relative to the chord.
    const sweep = 1;
    path = `M ${sx} ${sy} A ${curviness} ${curviness} 0 0 ${sweep} ${tx} ${ty}`;

    // Position label directly on the mid-arc peak
    // Calculate the height of the circular segment peak for given radius and chord.
    const halfChord = (arcLen / 2);
    // Triangle: curviness^2 = halfChord^2 + (curviness - h)^2
    // h = curviness - sqrt(curviness^2 - halfChord^2)
    const h = curviness - Math.sqrt(Math.max(0, curviness * curviness - halfChord * halfChord));

    const midX = (sx + tx) / 2;
    const midY = (sy + ty) / 2;
    // For sweep 1, bulge is in direction (px, py)
    labelX = midX + px * h;
    labelY = midY + py * h;
  }

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: 'var(--bg-secondary, #1e293b)',
              padding: '1px 5px',
              borderRadius: '4px',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--accent)',
              pointerEvents: 'all',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5)',
              zIndex: 1000
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
