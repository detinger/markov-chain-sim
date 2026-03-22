import { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';

export default function CircleNode({ data }: { data: { label: string, onRename: (s: string) => void } }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(data.label);

  useEffect(() => {
    setName(data.label);
  }, [data.label]);

  const handleBlur = () => {
    setIsEditing(false);
    if (name.trim() !== '' && name !== data.label) {
      data.onRename(name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
      if (name.trim() !== '' && name !== data.label) {
        data.onRename(name);
      }
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setName(data.label);
    }
  };

  return (
    <div
      style={{
        borderRadius: '50%',
        width: 100,
        height: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        background: 'rgba(15, 23, 42, 1.0)',
        color: '#f8fafc',
        border: '4px solid var(--accent)',
        boxShadow: '0 8px 15px -3px rgba(0, 0, 0, 0.4)',
        padding: '10px',
        textAlign: 'center',
        fontSize: '13px',
        position: 'relative'
      }}
    >
      {/* 
          IMPORTANT: The node itself is handled by ReactFlow for dragging. 
          We only wrap the name in an editor.
      */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        {isEditing ? (
          <input
            autoFocus
            className="nodrag"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{
              width: '70px',
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid var(--accent)',
              color: '#fff',
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: 'bold',
              outline: 'none'
            }}
          />
        ) : (
          <div 
            onDoubleClick={() => setIsEditing(true)}
            title="Double Click to rename"
            style={{ 
              userSelect: 'none',
              cursor: 'text'
            }}
          >
            {data.label}
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: 'transparent',
          border: 'none',
          top: '50%',
          left: '50%',
          width: '1px',
          height: '1px',
          transform: 'translate(-50%, -50%)',
          zIndex: -1
        }}
      />
      <Handle
        type="source"
        position={Position.Top}
        style={{
          background: 'transparent',
          border: 'none',
          top: '50%',
          left: '50%',
          width: '1px',
          height: '1px',
          transform: 'translate(-50%, -50%)',
          zIndex: -1
        }}
      />
    </div>
  );
}
