import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  useEdges,
  useInternalNode
} from '@xyflow/react';

export default function ArcEdge({
  id,
  source,
  target,
  style = {},
  markerEnd,
  label,
  selected,
  data
}: EdgeProps) {
  const edgeData = (data ?? {}) as { draft?: boolean; onSelect?: () => void; description?: string };
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const edges = useEdges();

  if (!sourceNode || !targetNode) return null;

  const getCenter = (node: typeof sourceNode) => ({
    x:
      (node.internals.positionAbsolute?.x ?? 0) +
      (node.measured?.width ?? 0) / 2,
    y:
      (node.internals.positionAbsolute?.y ?? 0) +
      (node.measured?.height ?? 0) / 2
  });

  const sourceCenter = getCenter(sourceNode);
  const targetCenter = getCenter(targetNode);

  let path = '';
  let labelX = 0;
  let labelY = 0;

  if (source === target) {
    const nodeRadius = (sourceNode.measured.width ?? 100) / 2;

    const selfLoops = edges
      .filter((e) => e.source === source && e.target === source)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));

    const myIndex = Math.max(
      0,
      selfLoops.findIndex((e) => e.id === id)
    );

    // always top, spread slightly left/right if multiple
    const baseAngle = -Math.PI / 2;
    const spreadStep = Math.PI / 10;
    const spreadOffset =
      (myIndex - (selfLoops.length - 1) / 2) * spreadStep;

    const finalAngle = baseAngle + spreadOffset;

    const loopRadius = nodeRadius * 0.6;
    const offset = Math.PI / 6;

    const startAngle = finalAngle - offset;
    const endAngle = finalAngle + offset;

    const sx = sourceCenter.x + nodeRadius * Math.cos(startAngle);
    const sy = sourceCenter.y + nodeRadius * Math.sin(startAngle);

    const tx = sourceCenter.x + nodeRadius * Math.cos(endAngle);
    const ty = sourceCenter.y + nodeRadius * Math.sin(endAngle);

    path = `M ${sx} ${sy} A ${loopRadius} ${loopRadius} 0 1 1 ${tx} ${ty}`;

    const distance = nodeRadius + loopRadius * 1.45;
    labelX = sourceCenter.x + distance * Math.cos(finalAngle);
    labelY = sourceCenter.y + distance * Math.sin(finalAngle);
  } else {
    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const nx = dx / dist;
    const ny = dy / dist;

    const px = -ny;
    const py = nx;

    const sourceRadius = (sourceNode.measured.width ?? 100) / 2;
    const targetRadius = (targetNode.measured.width ?? 100) / 2;

    const sx = sourceCenter.x + nx * sourceRadius;
    const sy = sourceCenter.y + ny * sourceRadius;

    const tx = targetCenter.x - nx * targetRadius;
    const ty = targetCenter.y - ny * targetRadius;

    // all non-self edges between the same unordered pair of nodes
    const pairEdges = edges
      .filter(
        (e) =>
          e.source !== e.target &&
          ((e.source === source && e.target === target) ||
            (e.source === target && e.target === source))
      )
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));

    const pairCount = pairEdges.length;
    const myIndex = Math.max(
      0,
      pairEdges.findIndex((e) => e.id === id)
    );

    // distribute edges around centerline:
    // 1 edge  -> [0]
    // 2 edges -> [-0.5, +0.5]
    // 3 edges -> [-1, 0, +1]
    const lane = myIndex - (pairCount - 1) / 2;

    // stable sign so A->B and B->A bend opposite ways
    const canonicalForward = source < target;
    const baseSign = canonicalForward ? 1 : -1;

    // for exactly 2 opposite edges this gives one up, one down
    // for more edges it fans out cleanly
    const curveStrength = Math.min(60, Math.max(28, dist * 0.22));
    const offsetAmount =
      pairCount === 1 ? curveStrength * 0.55 : lane * curveStrength * baseSign;

    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;

    const cx = mx + px * offsetAmount;
    const cy = my + py * offsetAmount;

    // quadratic bezier:
    // simpler to control, labels are easy to place,
    // markerEnd stays tangent to the path
    path = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;

    // label at t=0.5 on quadratic bezier
    const t = 0.5;
    labelX =
      (1 - t) * (1 - t) * sx +
      2 * (1 - t) * t * cx +
      t * t * tx;

    labelY =
      (1 - t) * (1 - t) * sy +
      2 * (1 - t) * t * cy +
      t * t * ty;

    // nudge labels further away if there are parallel/opposite edges
    if (pairCount > 1) {
      const extra = 10 * Math.sign(offsetAmount || baseSign);
      labelX += px * extra;
      labelY += py * extra;
    }
  }

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={style} interactionWidth={14} />

      {label && (
        <EdgeLabelRenderer>
          <button
            type="button"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className={`edge-label nodrag nopan${selected ? ' selected' : ''}${edgeData.draft ? ' draft' : ''}`}
            onClick={edgeData.onSelect}
            aria-label={edgeData.description}
          >
            {label}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
