import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Shuffle } from 'lucide-react';
import useStore from '../store/index.js';
import NodeBase, { NodeHeader, NodeProp } from './NodeBase.jsx';

export default function RandomTapNode({ id, data, selected }) {
  const activeNodeId = useStore((s) => s.activeNodeId);
  const isActive     = activeNodeId === id;

  return (
    <NodeBase selected={selected} isActive={isActive} categoryClass="node-action">
      <NodeHeader
        icon={<Shuffle size={13} />}
        label={data.label || 'Random Tap'}
        bgColor="rgba(168, 85, 247, 0.15)"
        textColor="#a855f7"
      />

      <div className="px-3 py-2 space-y-1 bg-bg-primary bg-opacity-40">
        <NodeProp label="Area X" value={`${data.x1 ?? 0} → ${data.x2 ?? 0}`} />
        <NodeProp label="Area Y" value={`${data.y1 ?? 0} → ${data.y2 ?? 0}`} />
        {data.duration && <NodeProp label="Duration" value={`${data.duration}ms`} />}
      </div>

      <Handle type="target" position={Position.Left}  id="in"  style={{ background: '#8b949e', border: '2px solid #484f58' }} />
      <Handle type="source" position={Position.Right} id="out" style={{ background: '#8b949e', border: '2px solid #484f58' }} />
    </NodeBase>
  );
}
