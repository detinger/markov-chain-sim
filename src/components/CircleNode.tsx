import { useEffect, useState, type KeyboardEvent } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';

export type StateNodeData = {
  label: string;
  isStart: boolean;
  startMass: number;
  absorbing: boolean;
  invalid: boolean;
  unreachable: boolean;
  color: string;
  /** Current state of the sample trajectory. */
  active?: boolean;
  onRename: (label: string) => void;
};

export default function CircleNode({ data }: NodeProps<Node<StateNodeData>>) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(data.label);

  useEffect(() => setName(data.label), [data.label]);

  const commit = () => {
    setIsEditing(false);
    if (name.trim() !== '' && name !== data.label) data.onRename(name.trim());
    else setName(data.label);
  };

  const onInputKey = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { setIsEditing(false); setName(data.label); }
  };

  const desc = [
    data.isStart ? `start probability ${data.startMass}` : null,
    data.absorbing ? 'absorbing' : null,
    data.invalid ? 'row needs repair' : null,
    data.unreachable ? 'not reachable from the start' : null,
    data.active ? 'current simulation state' : null,
  ].filter(Boolean).join(', ');

  return (
    <div
      className={`state-node${data.absorbing ? ' absorbing' : ''}${data.unreachable ? ' unreachable' : ''}${data.active ? ' sim-current' : ''}`}
      onDoubleClick={() => setIsEditing(true)}
      onKeyDown={(e) => {
        // Keyboard rename alternative to double-click (B03).
        if (!isEditing && (e.key === 'F2' || e.key === 'Enter')) { e.preventDefault(); setIsEditing(true); }
      }}
      title="Double-click or press Enter to rename. Drag the center to connect; drag the edge to move."
      aria-label={`State ${data.label}${desc ? ` (${desc})` : ''}`}
    >
      <span className="state-swatch" style={{ background: data.color }} aria-hidden="true" />
      {data.isStart && <span className="state-start" aria-hidden="true">{data.startMass === 1 ? 'Start →' : `Start ${data.startMass} →`}</span>}
      {isEditing ? (
        <input
          autoFocus
          className="state-rename nodrag"
          value={name}
          aria-label="State name"
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={onInputKey}
        />
      ) : (
        <span className="state-label">{data.label || 'Unnamed'}</span>
      )}
      {(data.absorbing || data.invalid) && (
        <span className="state-flags" aria-hidden="true">
          {data.absorbing && <span className="state-flag">Absorbing</span>}
          {data.invalid && <span className="state-flag error">Row ≠ 1</span>}
        </span>
      )}
      <Handle type="target" position={Position.Top} className="state-target" isConnectableStart={false} />
      {!isEditing && <Handle type="source" position={Position.Top} className="state-connect" aria-label={`Drag to connect from ${data.label}`} />}
    </div>
  );
}
