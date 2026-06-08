import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Type } from 'lucide-react';
import useStore from '../store/index.js';
import NodeBase, { NodeHeader } from './NodeBase.jsx';

export default function TypeTextNode({ id, data, selected }) {
  const activeNodeId = useStore((s) => s.activeNodeId);
  const isActive = activeNodeId === id;

  return (
    <NodeBase
      selected={selected}
      isActive={isActive}
      categoryClass="node-action"
    >
      <NodeHeader
        icon={<Type size={13} />}
        label={data.label || 'Type Text'}
        bgColor="rgba(168, 85, 247, 0.15)"
        textColor="#a855f7"
      />

      <div className="px-3 py-2 bg-bg-primary bg-opacity-40">
        {data.text ? (
          <div
            className="text-xs text-text-secondary bg-bg-tertiary rounded px-2 py-1 truncate max-w-[170px] font-mono"
            title={data.text}
          >
            "{data.text}"
          </div>
        ) : (
          <div className="text-xs text-text-muted italic">No text set</div>
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
