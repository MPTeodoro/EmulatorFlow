import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Terminal } from 'lucide-react';
import useStore from '../store/index.js';
import NodeBase, { NodeHeader } from './NodeBase.jsx';

export default function LogNode({ id, data, selected }) {
  const activeNodeId = useStore((s) => s.activeNodeId);
  const isActive = activeNodeId === id;

  return (
    <NodeBase
      selected={selected}
      isActive={isActive}
      categoryClass="node-utility"
    >
      <NodeHeader
        icon={<Terminal size={13} />}
        label={data.label || 'Log'}
        bgColor="rgba(139, 148, 158, 0.1)"
        textColor="#8b949e"
      />

      <div className="px-3 py-2 bg-bg-primary bg-opacity-40">
        {data.message ? (
          <div
            className="text-xs text-text-secondary bg-bg-tertiary rounded px-2 py-1 truncate max-w-[170px] font-mono"
            title={data.message}
          >
            {data.message}
          </div>
        ) : (
          <div className="text-xs text-text-muted italic">No message</div>
        )}
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
