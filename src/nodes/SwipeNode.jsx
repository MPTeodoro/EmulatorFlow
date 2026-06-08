import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { MoveRight } from 'lucide-react';
import useStore from '../store/index.js';
import NodeBase, { NodeHeader, NodeProp } from './NodeBase.jsx';

export default function SwipeNode({ id, data, selected }) {
  const activeNodeId = useStore((s) => s.activeNodeId);
  const isActive = activeNodeId === id;

  return (
    <NodeBase
      selected={selected}
      isActive={isActive}
      categoryClass="node-action"
    >
      <NodeHeader
        icon={<MoveRight size={13} />}
        label={data.label || 'Swipe'}
        bgColor="rgba(168, 85, 247, 0.15)"
        textColor="#a855f7"
      />

      <div className="px-3 py-2 space-y-1 bg-bg-primary bg-opacity-40">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted">From:</span>
          <span className="text-text-secondary">
            ({data.x1 !== undefined ? data.x1 : '—'}, {data.y1 !== undefined ? data.y1 : '—'})
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted">To:</span>
          <span className="text-text-secondary">
            ({data.x2 !== undefined ? data.x2 : '—'}, {data.y2 !== undefined ? data.y2 : '—'})
          </span>
        </div>
        {data.duration && <NodeProp label="Duration" value={`${data.duration}ms`} />}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{ background: '#8b949e', border: '2px solid #484f58' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ background: '#8b949e', border: '2px solid #484f58' }}
      />
    </NodeBase>
  );
}
