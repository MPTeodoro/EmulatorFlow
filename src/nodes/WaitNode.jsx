import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Timer } from 'lucide-react';
import useStore from '../store/index.js';
import NodeBase, { NodeHeader, NodeProp } from './NodeBase.jsx';

export default function WaitNode({ id, data, selected }) {
  const activeNodeId = useStore((s) => s.activeNodeId);
  const isActive = activeNodeId === id;

  return (
    <NodeBase
      selected={selected}
      isActive={isActive}
      categoryClass="node-control"
    >
      <NodeHeader
        icon={<Timer size={13} />}
        label={data.label || 'Wait'}
        bgColor="rgba(249, 115, 22, 0.15)"
        textColor="#f97316"
      />

      <div className="px-3 py-2 bg-bg-primary bg-opacity-40">
        <NodeProp
          label="Duration"
          value={data.seconds !== undefined ? `${data.seconds}s` : '1s'}
        />
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
